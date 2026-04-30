export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

    // 1. TENGENEZA UNIQUE CHECKOUT ID
    const checkout_id = 'TXN-' + Date.now();

    // 2. INSERT KWA SUPABASE KWANZA - payment_status = 'pending'
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY  // ← SERVICE_KEY kwa backend
    );

    console.log('INSERTING PENDING TO SUPABASE...');
    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        amount: Number(amount),
        phone: String(phone),
        checkout_id: checkout_id,
        payment_status: 'pending'  // ← Muhimu sana
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
        external_reference: checkout_id,  // ← Tumia checkout_id hiyo hiyo
        callback_url: 'https://mpesa-stk-api.vercel.app/api/callback'
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      // Kama STK imeshindwa, update status iwe 'failed'
      await supabase
        .from('payments')
        .update({ payment_status: 'failed' })
        .eq('checkout_id', checkout_id);
      
      return res.status(400).json({ success: false, payhero_error: data });
    }

    // 4. RUDISHA JIBU KWA FRONTEND
    return res.status(200).json({ 
      success: true, 
      checkout_id: checkout_id,  // ← Rudisha hii kwa frontend ku-track
      data: data 
    });
    
  } catch (error) {
    console.log('!!! STK CRASH ERROR !!!', error.message);
    return res.status(500).json({ success: false, server_error: error.message });
  }
}
