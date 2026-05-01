import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // HII NDO MABADILIKO KUBWA - TUNAWAJIBU PAYHERO KWANZA
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })

  try {
    console.log('PAYHERO CALLBACK:', JSON.stringify(req.body))

    const { status, response, reference, external_reference } = req.body
    
    // PAYHERO ANARUDISHA ExternalReference = TXN-... YETU
    const ExternalReference = response?.ExternalReference || external_reference || reference

    if (!ExternalReference) {
      console.log('Missing ExternalReference')
      return
    }

    const { MpesaReceiptNumber, ResultCode, ResultDesc, Amount, Phone } = response || req.body
    const isSuccess = (status === true || status === 'success') && (ResultCode == 0 || ResultCode === '0')

    // KAMA ISHAKUWA SUCCESS, WACHA
    const { data: existing } = await supabase
      .from('payments')
      .select('payment_status')
      .eq('checkout_id', ExternalReference)
      .single()

    if (existing?.payment_status === 'success') {
      console.log('ALREADY PROCESSED, SKIPPING:', ExternalReference)
      return
    }

    if (isSuccess) {
      console.log('PAYMENT SUCCESS FOR:', ExternalReference)

      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'success',
          mpesa_receipt: MpesaReceiptNumber,
          amount: Amount,
          phone: Phone,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_id', ExternalReference)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
        return
      }

      console.log('DB UPDATED SUCCESSFULLY:', data)

    } else {
      console.log('PAYMENT FAILED:', ResultDesc)
      
      await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: ResultDesc,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_id', ExternalReference)
    }

  } catch (err) {
    console.error('CALLBACK CRASH:', err.message)
  }
}
