import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // Hii ni security - Vercel tu ndo anaweza piga hii URL
  if (req.headers.authorization !== Bearer ${process.env.CRON_SECRET}) {
    return res.status(401).end('Unauthorized')
  }

  try {
    // 1. Tafuta payments zote ziko pending kwa zaidi ya dakika 2
    const twoMinsAgo = new Date(Date.now() - 120000).toISOString()
    
    const { data: pendingPayments } = await supabase
      .from('payments')
      .select('checkout_id')
      .eq('payment_status', 'pending')
      .lt('created_at', twoMinsAgo)
      .limit(50)

    console.log(Askari amepata ${pendingPayments?.length} pending)

    // 2. Uliza PayHero kila moja
    for (const payment of pendingPayments || []) {
      try {
        const response = await fetch(
          https://backend.payhero.co.ke/api/v2/transaction-status?reference=${payment.checkout_id},
          {
            headers: { 
              'Authorization': Basic ${process.env.PAYHERO_API_KEY} 
            }
          }
        )
        
        const data = await response.json()

        // 3. Kama PayHero anasema SUCCESS, rekebisha database
        if (data.status === 'SUCCESS' && data.ResultCode == 0) {
          await supabase
            .from('payments')
            .update({
              payment_status: 'success',
              mpesa_receipt: data.MpesaReceiptNumber,
              amount: data.Amount,
              phone: data.Phone,
              updated_at: new Date().toISOString(),
              recovered_by: 'cron'
            })
            .eq('checkout_id', payment.checkout_id)
          
          console.log('Askari ame-recover:', payment.checkout_id)
        } 
        
        // 4. Kama PayHero anasema FAILED
        else if (data.status === 'FAILED') {
          await supabase
            .from('payments')
            .update({
              payment_status: 'failed',
              failure_reason: data.ResultDesc,
              updated_at: new Date().toISOString(),
              recovered_by: 'cron'
            })
            .eq('checkout_id', payment.checkout_id)
        }

      } catch (err) {
        console.error('Askari ameshindwa:', payment.checkout_id, err.message)
      }
    }

    res.status(200).json({ success: true, checked: pendingPayments?.length || 0 })

  } catch (err) {
    console.error('ASKARI ERROR:', err.message)
    res.status(500).json({ error: err.message })
  }
}
