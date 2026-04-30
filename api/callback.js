import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { status, response } = req.body

    if (status === true && response && response.ResultCode === 0) {
      const { ExternalReference, MpesaReceiptNumber } = response

      const { error } = await supabase
        .from('payments')
        .update({
          payment_status: 'paid',
          mpesa_receipt: MpesaReceiptNumber
        })
        .eq('checkout_id', ExternalReference)

      if (error) {
        console.log('DB Error:', error)
      }
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' })
    
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
}
