export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

    // 1. TUMIA HII KAMA CHECKOUT_ID - PAYHERO ATARUDISHA HII KWA CALLBACK
    const checkout_id = 'TXN-' + Date.now();

    // 2. INSERT KWA SUPABASE KWANZA
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    console.log('INSERTING PENDING TO SUPABASE:', checkout_id);
    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        amount: Number(amount),
        phone: String(phone),
        checkout_id: checkout_id, // ← TXN-... HII NDIO CALLBACK ITATUMIA
        payment_status: 'pending'
      });

    if (dbError) {
      console.log('!!! SUPABASE INSERT ERROR !!!', dbError.message);
      return res.status(500).json({ success: false, db_error: dbError.message });
    }
    
    console.log('PENDING ROW IMEINGIA:', checkout_id);

    // 3. TUMA STK PUSH KWA PAYHERO
    const auth = Buffer.from(process.env.PAYHERO_USER + ':' + process.env.PAYHERO_PASS).toString('base64');

    const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: Number(amount),
        phone_number: String(phone),
        channel_id: Number(process.env.CHANNEL_ID),
        provider: 'm-pesa',
        external_reference: checkout_id, // ← TUMA HII KWA PAYHERO
        callback_url: 'https://mpesa-stk-api.vercel.app/api/callback'
      })
    });

    const data = await response.json();
    console.log('Payhero Response:', data);
    
    // 4. CHECK KAMA PAYHERO AMEKUBALI - USIANGALIE STATUS
    if (!data.reference) {
      await supabase
        .from('payments')
        .update({ payment_status: 'failed' })
        .eq('checkout_id', checkout_id);
      
      return res.status(400).json({ success: false, payhero_error: data });
    }

    // 5. RUDISHA TXN-... KWA FRONTEND
    return res.status(200).json({ 
      success: true, 
      checkout_id: checkout_id, // ← HII NDIO FRONTEND ITATUMIA
      CheckoutRequestID: checkout_id,
      data: data 
    });
    
  } catch (error) {
    console.log('!!! STK CRASH ERROR !!!', error.message);
    return res.status(500).json({ success: false, server_error: error.message });
  }
}
