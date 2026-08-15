import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Use POST only'
    })
  }

  try {
    const { phone, amount } = req.body

    if (!phone || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Phone and amount required'
      })
    }

    const numericAmount = Number(amount)
    const phoneNumber = String(phone)

    if (!Number.isInteger(numericAmount) || numericAmount < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      })
    }

    if (!/^254[17][0-9]{8}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid M-Pesa phone number'
      })
    }

    /*
     * Temporary internal reference.
     * After Safaricom accepts the STK request,
     * we replace checkout_id with the real
     * Daraja CheckoutRequestID.
     */
    const temporaryReference = 'TXN-' + Date.now()

    // Save payment as pending first
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        amount: numericAmount,
        phone: phoneNumber,
        checkout_id: temporaryReference,
        payment_status: 'pending'
      })

    if (insertError) {
      console.error('SUPABASE INSERT ERROR:', insertError)

      return res.status(500).json({
        success: false,
        error: 'Could not create payment record'
      })
    }

    /*
     * STEP 1:
     * Get Safaricom OAuth access token
     */
    const consumerKey = process.env.DARAJA_CONSUMER_KEY
    const consumerSecret = process.env.DARAJA_CONSUMER_SECRET

    if (!consumerKey || !consumerSecret) {
      console.error('Missing Daraja consumer credentials')

      await supabase
        .from('payments')
        .update({
          payment_status: 'Failed',
          failure_reason: 'Daraja credentials not configured'
        })
        .eq('checkout_id', temporaryReference)

      return res.status(500).json({
        success: false,
        error: 'Daraja credentials not configured'
      })
    }

    const credentials = Buffer
      .from(`${consumerKey}:${consumerSecret}`)
      .toString('base64')

    const tokenResponse = await fetch(
      'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`
        }
      }
    )

    const tokenData = await tokenResponse.json()

    console.log('DARaja TOKEN RESPONSE:', {
      status: tokenResponse.status,
      hasToken: !!tokenData.access_token
    })

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('DARaja OAuth ERROR:', tokenData)

      await supabase
  .from('payments')
  .update({
    payment_status: 'Failed',
    failure_reason: 'Unable to authenticate with Safaricom Daraja'
  })
  .eq('checkout_id', temporaryReference)

      return res.status(500).json({
        success: false,
        error: 'Unable to authenticate with Safaricom'
      })
    }

    /*
     * STEP 2:
     * Generate STK Push password
     */
    const shortcode = process.env.DARAJA_SHORTCODE
    const passkey = process.env.DARAJA_PASSKEY

    if (!shortcode || !passkey) {
      console.error('Missing Daraja shortcode/passkey')

      await supabase
        .from('payments')
        .update({
          payment_status: 'Failed',
          failure_reason: 'Daraja shortcode/passkey not configured'
        })
        .eq('checkout_id', temporaryReference)

      return res.status(500).json({
        success: false,
        error: 'Daraja STK credentials not configured'
      })
    }

    /*
     * Daraja timestamp:
     * YYYYMMDDHHmmss
     */
    const now = new Date()

    const pad = (number) => String(number).padStart(2, '0')

    const timestamp =
      now.getFullYear().toString() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes()) +
      pad(now.getSeconds())

    const password = Buffer
      .from(`${shortcode}${passkey}${timestamp}`)
      .toString('base64')

    /*
     * STEP 3:
     * Send STK Push directly to Safaricom
     */
    const callbackUrl =
      process.env.DARAJA_CALLBACK_URL ||
      'https://mpesa-stk-api.vercel.app/api/callback'

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: numericAmount,
      PartyA: phoneNumber,
      PartyB: shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: temporaryReference,
      TransactionDesc: 'M-Pesa Payment'
    }

    console.log('SENDING DARaja STK:', {
      amount: numericAmount,
      phone: phoneNumber,
      shortcode,
      callbackUrl,
      accountReference: temporaryReference
    })

    const stkResponse = await fetch(
      'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(stkPayload)
      }
    )

    const stkData = await stkResponse.json()

    console.log('DARaja STK RESPONSE:', stkData)

    /*
     * STEP 4:
     * Check whether Safaricom accepted the request
     */
    if (
      !stkResponse.ok ||
      stkData.ResponseCode !== '0'
    ) {
      const reason =
        stkData.errorMessage ||
        stkData.ResponseDescription ||
        stkData.CustomerMessage ||
        'Safaricom rejected STK Push request'

      await supabase
  .from('payments')
  .update({
    payment_status: 'Failed',
    failure_reason: 'Unable to authenticate with Safaricom Daraja'
  })
  .eq('checkout_id', temporaryReference)

      return res.status(400).json({
        success: false,
        error: reason,
        data: stkData
      })
    }

    /*
     * IMPORTANT:
     * We now have the real Daraja CheckoutRequestID.
     *
     * We use it as our checkout_id so:
     *
     * Frontend
     *    ↓
     * check-payment?ref=CheckoutRequestID
     *
     * and
     *
     * Safaricom callback
     *    ↓
     * CheckoutRequestID
     *
     * both point to the same database row.
     */
    const darajaCheckoutRequestID = stkData.CheckoutRequestID

    const { error: updateError } = await supabase
      .from('payments')
      .update({
  checkout_id: darajaCheckoutRequestID
})
      .eq('checkout_id', temporaryReference)

    if (updateError) {
      console.error(
        'FAILED TO SAVE DARaja CheckoutRequestID:',
        updateError
      )

      return res.status(500).json({
        success: false,
        error: 'STK sent but payment record could not be updated'
      })
    }

    /*
     * Return CheckoutRequestID to frontend.
     */
    return res.status(200).json({
      success: true,
      checkout_id: darajaCheckoutRequestID,
      merchant_request_id: stkData.MerchantRequestID,
      customer_message:
        stkData.CustomerMessage || 'STK Push sent successfully'
    })

  } catch (error) {
    console.error('DARaja STK ERROR:', error)

    return res.status(500).json({
      success: false,
      error: 'Server error'
    })
  }
}
