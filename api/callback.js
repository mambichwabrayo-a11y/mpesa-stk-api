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
    console.log('PAYHERO FULL CALLBACK:', JSON.stringify(req.body, null, 2))

    const body = req.body
    const response = body.response || {}
    
    // TAFUTA ExternalReference KWA NJIA ZOTE PAYHERO ANATUMIA
    const ExternalReference = 
      response.ExternalReference || 
      response.external_reference || 
      body.external_reference || 
      body.ExternalReference ||
      body.reference ||
      body.Reference

    const ResultCode = response.ResultCode ?? body.ResultCode
    const ResultDesc = response.ResultDesc ?? body.ResultDesc ?? 'No description'
    const MpesaReceiptNumber = response.MpesaReceiptNumber ?? body.MpesaReceiptNumber
    const Amount = response.Amount ?? body.Amount
    const Phone = response.Phone ?? body.Phone

    console.log('EXTRACTED:', { ExternalReference, ResultCode, ResultDesc })

    if (!ExternalReference) {
      console.log('FATAL: No ExternalReference found')
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'No reference' })
    }

    // CHECK KAMA ROW IPO
    const { data: existing } = await supabase
      .from('payments')
      .select('*')
      .eq('checkout_id', ExternalReference)
      .single()

    console.log('EXISTING ROW:', existing)

    if (!existing) {
      console.log('ERROR: Row not found for', ExternalReference)
      // TENGENEZA ROW KAMA HAIKUWEPO
      await supabase.from('payments').insert({
        checkout_id: ExternalReference,
        payment_status: 'pending',
        amount: Amount,
        phone: Phone
      })
    }

    const isSuccess = ResultCode == 0
    const isCancelled = ResultCode == 1032 || ResultDesc?.toLowerCase().includes('cancel')
    
    if (isSuccess) {
      console.log('UPDATING TO SUCCESS')
      await supabase.from('payments').update({
        payment_status: 'success',
        mpesa_receipt: MpesaReceiptNumber,
        amount: Amount,
        phone: Phone
      }).eq('checkout_id', ExternalReference)

    } else if (isCancelled) {
      console.log('UPDATING TO CANCELLED')
      await supabase.from('payments').update({
        payment_status: 'Cancelled',
        failure_reason: ResultDesc
      }).eq('checkout_id', ExternalReference)
      
    } else {
      console.log('UPDATING TO FAILED')
      await supabase.from('payments').update({
        payment_status: 'Failed',
        failure_reason: ResultDesc
      }).eq('checkout_id', ExternalReference)
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' })

  } catch (err) {
    console.error('CALLBACK CRASH:', err)
    res.status(500).json({ error: 'Server error' })
  }
}
