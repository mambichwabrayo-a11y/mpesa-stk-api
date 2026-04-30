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
    console.log('PAYHERO CALLBACK:', req.body)
    
    const { status, response } = req.body
    
    // PayHero anatuma status: true na ResultCode: 0 kwa success
    if (status === true && response?.ResultCode === 0) {
      
      const { 
        ExternalReference,    // ← HII NDIO CHECKOUT_ID YAKO
        MpesaReceiptNumber, 
        Amount,
        Phone
      } = response

      console.log('Updating DB for:', ExternalReference)

      const { error } = await supabase
        .from('payments')
        .update({
          payment_status: 'paid',
          mpesa_receipt: MpesaReceiptNumber,
          amount: Amount,
          phone: Phone,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_id', ExternalReference) // ← Match na TXN-... yako

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
        return res.status(500).json({ error: 'DB update failed' })
      }

      console.log('SUCCESS: Payment updated', ExternalReference)
    } else {
      console.log('Payment failed or cancelled:', response?.ResultDesc)
      
      // Optional: Update status iwe 'failed'
      if (response?.ExternalReference) {
        await supabase
          .from('payments')
          .update({ payment_status: 'failed' })
          .eq('checkout_id', response.ExternalReference)
      }
    }

    // Jibu PayHero
    res.status(200).json({ ResultCode: 0, ResultDesc: "Success" })

  } catch (error) {
    console.error('CALLBACK CRASH:', error.message)
    res.status(500).json({ error: 'Server error' })
  }
}
