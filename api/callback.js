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

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Safaricom sends POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      ResultCode: 1,
      ResultDesc: 'Method not allowed'
    })
  }

  try {
    console.log(
      '=== DARAJA STK CALLBACK ===',
      JSON.stringify(req.body)
    )

    const callbackBody = req.body?.Body?.stkCallback

    if (!callbackBody) {
      console.log('ERROR: No stkCallback found')

      // Always acknowledge Safaricom callback
      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Accepted'
      })
    }

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata
    } = callbackBody

    console.log('DARAJA CALLBACK DATA:', {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc
    })

    if (!CheckoutRequestID) {
      console.log('ERROR: No CheckoutRequestID')

      return res.status(200).json({
        ResultCode: 0,
        ResultDesc: 'Accepted'
      })
    }

    /*
     * Extract CallbackMetadata
     */
    const metadataItems =
      CallbackMetadata?.Item || []

    const getMetadataValue = (name) => {
      const item = metadataItems.find(
        (entry) => entry.Name === name
      )

      return item?.Value ?? null
    }

    const amount = getMetadataValue('Amount')
    const mpesaReceipt =
      getMetadataValue('MpesaReceiptNumber')
    const transactionDate =
      getMetadataValue('TransactionDate')
    const phone =
      getMetadataValue('PhoneNumber')

    console.log('EXTRACTED PAYMENT DATA:', {
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      amount,
      mpesaReceipt,
      transactionDate,
      phone
    })

    /*
     * Determine payment status
     */
    let payment_status = 'failed'

    if (Number(ResultCode) === 0) {
      payment_status = 'success'
    } else if (Number(ResultCode) === 1032) {
      payment_status = 'Cancelled'
    } else {
      payment_status = 'failed'
    }

    console.log('PAYMENT STATUS:', payment_status)

    /*
     * Build update data
     */
    const updateData = {
  payment_status
}

    /*
     * Save successful transaction details
     */
    if (payment_status === 'success') {
      if (mpesaReceipt) {
        updateData.mpesa_receipt = String(mpesaReceipt)
      }

      if (amount !== null) {
        updateData.amount = Number(amount)
      }

      if (phone) {
        updateData.phone = String(phone)
      }
    }

    /*
     * Save failure reason
     */
    if (payment_status === 'failed') {
      updateData.failure_reason =
        ResultDesc || 'M-Pesa payment failed'
    }

    /*
     * Save cancellation reason
     */
    if (payment_status === 'Cancelled') {
      updateData.failure_reason =
        ResultDesc || 'Request cancelled by user'
    }

    /*
     * IMPORTANT:
     *
     * stk.js already changes our temporary TXN reference
     * to Safaricom's CheckoutRequestID.
     *
     * Therefore the callback can directly search:
     *
     * checkout_id = CheckoutRequestID
     */
    console.log('UPDATING SUPABASE:', {
      checkout_id: CheckoutRequestID,
      updateData
    })

    const { data, error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('checkout_id', CheckoutRequestID)
      .select()

    if (error) {
      console.error(
        'SUPABASE UPDATE ERROR:',
        error
      )
    } else {
      console.log(
        'SUPABASE UPDATE RESULT:',
        data
      )

      if (!data || data.length === 0) {
        console.log(
          'WARNING: No payment row matched CheckoutRequestID:',
          CheckoutRequestID
        )
      } else {
        console.log(
          'PAYMENT UPDATED SUCCESSFULLY:',
          CheckoutRequestID
        )
      }
    }

    /*
     * Always acknowledge Safaricom.
     *
     * This prevents Safaricom from treating the callback
     * as failed because of our internal processing.
     */
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Accepted'
    })

  } catch (error) {
    console.error(
      'DARAJA CALLBACK ERROR:',
      error
    )

    /*
     * Still acknowledge Safaricom.
     */
    return res.status(200).json({
      ResultCode: 0,
      ResultDesc: 'Accepted'
    })
  }
}
