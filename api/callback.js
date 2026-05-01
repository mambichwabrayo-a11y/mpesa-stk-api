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
    console.log('=== PAYHERO CALLBACK RECEIVED ===')
    console.log('FULL BODY:', JSON.stringify(req.body, null, 2))

    const { status, response, reference, external_reference } = req.body
    const ExternalReference = response?.ExternalReference || external_reference || reference

    console.log('EXTRACTED ExternalReference:', ExternalReference)

    if (!ExternalReference) {
      console.log('ERROR: Missing ExternalReference - Cannot update DB')
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'No reference' })
    }

    const { MpesaReceiptNumber, ResultCode, ResultDesc, Amount, Phone } = response || req.body
    console.log('ResultCode:', ResultCode, 'Status:', status)
    console.log('MpesaReceiptNumber:', MpesaReceiptNumber)

    const isSuccess = (status === true || status === 'success') && (ResultCode === 0 || ResultCode === '0')

    if (isSuccess) {
      console.log('ATTEMPTING SUCCESS UPDATE FOR:', ExternalReference)

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

      console.log('SUCCESS: DB UPDATED. Rows affected:', data?.length, 'Data:', data)

    } else {
      console.log('ATTEMPTING FAILED UPDATE FOR:', ExternalReference, 'Reason:', ResultDesc)
      
      const { data, error } = await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: ResultDesc || 'Transaction failed'
        })
        .eq('checkout_id', ExternalReference)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
      } else {
        console.log('FAILED: DB UPDATED. Rows affected:', data?.length)
      }
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' })

  } catch (err) {
    console.error('CALLBACK CRASH:', err.message, err.stack)
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Server error but accepted' })
  }
}
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// HAKIKISHA HAKUNA "function handler" AMA "const handler" HAPA JUU
// LAZIMA IKUE HII TU MOJA 👇
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    console.log('=== PAYHERO CALLBACK RECEIVED ===')
    console.log('FULL BODY:', JSON.stringify(req.body, null, 2))

    const { status, response, reference, external_reference } = req.body
    const ExternalReference = response?.ExternalReference || external_reference || reference

    console.log('EXTRACTED ExternalReference:', ExternalReference)

    if (!ExternalReference) {
      console.log('ERROR: Missing ExternalReference')
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'No reference' })
    }

    const { MpesaReceiptNumber, ResultCode, ResultDesc, Amount, Phone } = response || req.body
    console.log('ResultCode:', ResultCode, 'Status:', status)

    const isSuccess = (status === true || status === 'success') && (ResultCode === 0 || ResultCode === '0')

    if (isSuccess) {
      console.log('ATTEMPTING SUCCESS UPDATE FOR:', ExternalReference)

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

      console.log('SUCCESS: DB UPDATED. Rows affected:', data?.length)

    } else {
      console.log('ATTEMPTING FAILED UPDATE FOR:', ExternalReference, 'Reason:', ResultDesc)
      
      const { data, error } = await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: ResultDesc || 'Transaction failed'
        })
        .eq('checkout_id', ExternalReference)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
      } else {
        console.log('FAILED: DB UPDATED. Rows affected:', data?.length)
      }
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' })

  } catch (err) {
    console.error('CALLBACK CRASH:', err.message)
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Server error but accepted' })
  }
}
// HAKIKISHA HAKUNA "export default" NYINGINE HAPA CHINI
