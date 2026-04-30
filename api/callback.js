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
    // Hii ndio format ya PayHero
    const { status, CheckoutRequestID, MpesaReceiptNumber, Amount, Phone } = req.body

    console.log('PayHero Callback:', req.body) // Check Vercel logs

    if (status === 'success') {
      // Update Supabase
      const { error } = await supabase
        .from('payments')
        .update({
          payment_status: 'paid',
          mpesa_receipt: MpesaReceiptNumber,
          amount: Amount,
          phone: Phone,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_id', CheckoutRequestID) // Hakikisha checkout_id inalingana

      if (error) {
        console.error('Supabase Error:', error)
        return res.status(500).json({ error: 'DB update failed' })
      }

      console.log('Payment updated successfully:', CheckoutRequestID)
    }

    // PayHero inataka ujibu hivi
    res.status(200).json({ ResultCode: 0, ResultDesc: "Success" })

  } catch (error) {
    console.error('Callback Error:', error)
    res.status(500).json({ error: 'Server error' })
  }
}
