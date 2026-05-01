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
    const { status, response, reference, external_reference, BillRefNumber } = req.body
    
    const ExternalReference = response?.ExternalReference || 
                             response?.external_reference || 
                             response?.BillRefNumber ||
                             external_reference || 
                             reference ||
                             BillRefNumber

    if (!ExternalReference) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'No reference' })
    }

    const { MpesaReceiptNumber, ResultCode, ResultDesc, Amount, Phone } = response || req.body
    const isSuccess = (status === true || status === 'success') && (ResultCode === 0 || ResultCode === '0')

    if (isSuccess) {
      await supabase
        .from('payments')
        .update({
          payment_status: 'success',
          mpesa_receipt: MpesaReceiptNumber,
          amount: Amount,
          phone: Phone
        })
        .eq('checkout_id', ExternalReference)
    } else {
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
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Error but accepted' })
  }
}
