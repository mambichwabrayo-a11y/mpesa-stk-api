import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    console.log('PAYHERO CALLBACK:', JSON.stringify(req.body))

    const { status, response, reference, external_reference } = req.body
    const ExternalReference = response?.ExternalReference || external_reference || reference

    if (!ExternalReference) {
      console.log('Missing ExternalReference')
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'No reference' })
    }

    const { MpesaReceiptNumber, ResultCode, ResultDesc, Amount, Phone } = response || req.body

    // SUCCESS: User entered PIN
    const isSuccess = (status === true || status === 'success') && (ResultCode === 0 || ResultCode === '0')

    if (isSuccess) {
      console.log('PAYMENT SUCCESS FOR:', ExternalReference)

      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'success',
          mpesa_receipt: MpesaReceiptNumber,
          amount: Amount,
          phone: Phone
        })
        .eq('checkout_id', ExternalReference)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'DB error but accepted' })
      }

      console.log('DB UPDATED SUCCESSFULLY:', data)

    } else {
      // FAILED: User cancelled or insufficient funds
      console.log('PAYMENT FAILED:', ResultDesc)
      
      await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: ResultDesc || 'Transaction failed'
        })
        .eq('checkout_id', ExternalReference)
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' })

  } catch (err) {
    console.error('CALLBACK CRASH:', err.message)
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Server error but accepted' })
  }
}
