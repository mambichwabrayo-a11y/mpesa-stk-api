import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    console.log('PAYHERO CALLBACK:', JSON.stringify(req.body))

    const { status, response } = req.body

    if (!response?.ExternalReference) {
      console.log('Missing ExternalReference')
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'No reference' })
    }

    const { ExternalReference, MpesaReceiptNumber, ResultCode, ResultDesc, Amount, Phone } = response

    if (status === true && ResultCode === 0) {
      console.log('PAYMENT SUCCESS FOR:', ExternalReference)

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
        return res.status(500).json({ error: 'Database update failed' })
      }

      console.log('DB UPDATED SUCCESSFULLY:', data)

    } else {
      console.log('PAYMENT FAILED:', ResultDesc)
      
      await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: ResultDesc 
        })
        .eq('checkout_id', ExternalReference)
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' })

  } catch (err) {
    console.error('CALLBACK CRASH:', err.message)
    res.status(500).json({ error: 'Server error' })
  }
}
