// api/callback.js - PAYHERO BULLETPROOF 24/7
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Hakikisha jina la env linafanana na la Vercel
)

// Jibu PayHero papo hapo. Hata kuna error, rudisha 200 ili asirudie callback
const respondOK = (res, msg = 'Accepted') => {
  return res.status(200).json({ ResultCode: 0, ResultDesc: msg })
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return respondOK(res, 'Method not POST')

  try {
    const body = req.body
    console.log('PAYHERO CALLBACK RAW:', JSON.stringify(body))

    // PayHero huweka data ndani ya 'response' ama direct
    const data = body?.response || body

    // 1. TAFUTA ExternalReference KUTOKA KILA MAHALI POSSIBLE
    const ExternalReference = 
      data?.ExternalReference || 
      data?.external_reference || 
      data?.reference || 
      body?.external_reference || 
      body?.reference ||
      body?.ExternalReference

    if (!ExternalReference) {
      console.log('ERROR: ExternalReference haipo')
      return respondOK(res, 'No ExternalReference')
    }

    // 2. TAFUTA DATA ZOTE ZA MALIPO
    const MpesaReceiptNumber = 
      data?.MpesaReceiptNumber || 
      data?.ReceiptNumber || 
      data?.mpesa_receipt || 
      'NO_RECEIPT'

    const ResultCode = data?.ResultCode ?? data?.result_code ?? body?.ResultCode ?? 1
    const ResultDesc = data?.ResultDesc || data?.result_desc || body?.ResultDesc || 'No desc'
    const Amount = data?.Amount || data?.amount || body?.amount || 0
    const Phone = data?.Phone || data?.phone || data?.msisdn || body?.phone || ''

    // Status ya PayHero inaweza kuwa true/false ama 'success'/'failed'
    const Status = body?.status || data?.Status || data?.status
    const isSuccess = 
      (Status === true || Status === 'success' || Status === 'SUCCESS') && 
      (ResultCode == 0 || ResultCode == '0' || ResultCode == '00')

    console.log('PARSED DATA:', { 
      ExternalReference, 
      MpesaReceiptNumber, 
      ResultCode, 
      isSuccess,
      Amount,
      Phone 
    })

    // 3. UPDATE SUPABASE - JARIBU MARA 3 KAMA IKIFAIL
    const updateData = isSuccess ? {
      payment_status: 'success',
      mpesa_receipt: MpesaReceiptNumber,
      amount: Amount,
      phone: Phone,
      failure_reason: null,
      updated_at: new Date().toISOString()
    } : {
      payment_status: 'failed',
      failure_reason: ResultDesc,
      updated_at: new Date().toISOString()
    }

    let attempts = 0
    let lastError = null
    
    while (attempts < 3) {
      attempts++
      
      const { error, count } = await supabase
        .from('payments')
        .update(updateData, { count: 'exact' })
        .eq('checkout_id', ExternalReference) // MUHIMU: Hakikisha column inaitwa 'checkout_id'

      if (!error && count > 0) {
        console.log(SUCCESS: DB updated on attempt ${attempts}. Rows: ${count})
        return respondOK(res, 'Updated')
      }

      lastError = error || new Error(No rows found for checkout_id: ${ExternalReference})
      console.log(ATTEMPT ${attempts} FAILED:, lastError.message)
      
      // Ngoja kidogo kabla ya kujaribu tena
      if (attempts < 3) await new Promise(r => setTimeout(r, 1500))
    }

    // 4. KAMA IMEFAIL BAADA YA RETRIES 3
    console.error('FINAL ERROR: Supabase update failed after 3 retries:', lastError)
    return respondOK(res, 'DB update failed but accepted')

  } catch (err) {
    console.error('CALLBACK CRASH:', err)
    return respondOK(res, 'Server error but accepted') // Muhimu: 200 always
  }
}
