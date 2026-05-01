import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // Jibu PayHero haraka - lazima iwe line ya kwanza
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })

  try {
    const body = req.body
    console.log('PAYHERO FULL CALLBACK:', JSON.stringify(body))

    // PayHero hutuma ExternalReference ndani ya response
    const checkout_id = body?.response?.ExternalReference
    const receipt = body?.response?.MpesaReceiptNumber
    const resultCode = body?.response?.ResultCode

    console.log('CHECKOUT_ID FOUND:', checkout_id)

    if (!checkout_id) {
      console.log('ERROR: Hakuna ExternalReference kwa callback')
      return
    }

    if (resultCode == 0) {
      console.log('UPDATING TO SUCCESS...')
      
      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'success',
          mpesa_receipt: receipt,
          amount: body?.response?.Amount,
          phone: body?.response?.Phone,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_id', checkout_id)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
      } else {
        console.log('DB UPDATED SUCCESSFULLY:', data)
      }

    } else {
      console.log('PAYMENT FAILED - ResultCode:', resultCode)
      await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: body?.response?.ResultDesc
        })
        .eq('checkout_id', checkout_id)
    }

  } catch (err) {
    console.error('CALLBACK ERROR:', err.message)
  }
}
