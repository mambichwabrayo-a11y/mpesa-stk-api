// api/callback.js - 24/7 BULLETPROOF
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // MUHIMU: PayHero anataka 200 ALWAYS, hata kama kuna error
  const respondOK = () => res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' })
  
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return respondOK()

  try {
    console.log('PAYHERO CALLBACK:', JSON.stringify(req.body))
    
    const body = req.body
    const response = body?.response || body
    
    // 1. SHIKA ExternalReference KUTOKA KILA MAHALI POSSIBLE
    const ExternalReference = 
      response?.ExternalReference || 
      response?.external_reference || 
      body?.external_reference || 
      body?.reference ||
      body?.ExternalReference

    if (!ExternalReference) {
      console.log('NO ExternalReference FOUND')
      return respondOK() // Rudisha 200 hata kama hakuna ref
    }

    // 2. SHIKA DATA ZOTE
    const MpesaReceiptNumber = response?.MpesaReceiptNumber || response?.ReceiptNumber || 'NO_RECEIPT'
    const ResultCode = response?.ResultCode ?? response?.result_code ?? body?.ResultCode
    const ResultDesc = response?.ResultDesc || response?.result_desc || 'No description'
    const Amount = response?.Amount || body?.amount
    const Phone = response?.Phone || body?.phone || body?.msisdn

    const status = body?.status || response?.Status
    const isSuccess = (status === true || status === 'success' || status === 'SUCCESS') && 
                      (ResultCode == 0 || ResultCode == '0')

    console.log('PARSED:', { ExternalReference, MpesaReceiptNumber, ResultCode, isSuccess })

    // 3. UPDATE SUPABASE NA RETRY MARA 3 KAMA IKIFAIL
    let attempts = 0
    let lastError = null
    
    while (attempts < 3) {
      const updateData = isSuccess ? {
        payment_status: 'success',
        mpesa_receipt: MpesaReceiptNumber,
        amount: Amount,
        phone: Phone,
        updated_at: new Date().toISOString()
      } : {
        payment_status: 'failed',
        failure_reason: ResultDesc,
        updated_at: new Date().toISOString()
      }

      const { error, count } = await supabase
        .from('payments')
        .update(updateData, { count: 'exact' })
        .eq('checkout_id', ExternalReference)

      if (!error && count > 0) {
        console.log('DB UPDATE SUCCESS ON ATTEMPT:', attempts + 1)
        return respondOK()
      }

      lastError = error || new Error('No rows updated')
      console.log(RETRY ${attempts + 1} FAILED:, lastError)
      attempts++
      
      if (attempts < 3) await new Promise(r => setTimeout(r, 1500)) // Ngoja 1.5sec
    }

    // 4. KAMA IMEFAIL BAADA YA RETRIES 3, LOG LAKINI RUDISHA 200 TU
    console.error('SUPABASE FAILED AFTER 3 RETRIES:', lastError)
    return respondOK()

  } catch (err) {
    console.error('CALLBACK CRASH:', err)
    return respondOK() // MUHIMU: Hata ikicrash rudisha 200
  }
}
