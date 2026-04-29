import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const data = req.body
    
    // Kama payment haikufaulu, achana nayo
    if (data.status !== 'Success') {
      console.log('Payment failed:', data.Reference)
      return res.status(200).json({ message: 'Payment not successful' })
    }

    // Save kwa Supabase
    const { error } = await supabase
      .from('payments')
      .insert({
        mpesa_receipt: data.MpesaReceiptNumber,
        amount: data.Amount,
        phone: data.Phone,
        reference: data.Reference,
        status: data.status,
        raw_data: data
      })

    if (error) {
      console.error('Supabase error:', error)
      return res.status(500).json({ error: 'Failed to save' })
    }

    console.log('Payment saved:', data.MpesaReceiptNumber)
    return res.status(200).json({ message: 'Payment saved' })

  } catch (err) {
    console.error('Error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}
