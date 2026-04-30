\import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' })

  try {
    console.log('PAYHERO CALLBACK RECEIVED:', JSON.stringify(req.body))

    const { status, response } = req.body

    // Check if payment was successful
    if (status === true && response?.ResultCode === 0) {
      
      const { 
        ExternalReference, 
        MpesaReceiptNumber, 
        Amount, 
        Phone 
      } = response

      console.log('UPDATING DB FOR:', ExternalReference)

      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'paid',
          mpesa_receipt: MpesaReceiptNumber,
          amount: Amount,
          phone: Phone
        })
        .eq('checkout_id', ExternalReference)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
        return res.status(500).json({ error: 'DB update failed', details: error.message })
      }

      console.log('SUCCESS: Payment updated', data)
      
    } else {
      // Payment failed or was cancelled
      console.log('PAYMENT FAILED:', response?.ResultDesc)
      
      if (response?.ExternalReference) {
        await supabase
          .from('payments')
          .update({ payment_status: 'failed' })
          .eq('checkout_id', response.ExternalReference)
      }
    }

    // Always respond 200 to PayHero
    res.status(200).json({ ResultCode: 0, ResultDesc: "Success" })

  } catch (error) {
    console.error('CALLBACK CRASH:', error.message)
    res.status(500).json({ error: 'Server error' })
  }
}
