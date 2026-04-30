export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

    // 1. TENGENEZA UNIQUE CHECKOUT ID - bado tunatumia kwa external_reference
    const temp_checkout_id = 'TXN-' + Date.now();

    // 2. TUMA STK PUSH KWA PAYHERO KWANZA - TUPATE REFERENCE YAKE
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
        external_reference: temp_checkout_id, // Payhero anaipuuza but ni sawa
        callback_url: 'https://mpesa-stk-api.vercel.app/api/callback'
      })
    });

    const data = await response.json();
    console.log('Payhero Response:', data);
    
    // 3. CHECK KAMA PAYHERO AMEKUBALI STK
    if (!response.ok || data.status !== 'success') {
      return res.status(400).json({ success: false, payhero_error: data });
    }

    // 4. TUMIA REFERENCE YA PAYHERO KAMA CHECKOUT_ID YETU - HII NDIO FIX
    const checkout_id = data.reference; // ← Payhero anarudisha hii kwa callback

    if (!checkout_id) {
      console.log('!!! PAYHERO HAKURUDISHA REFERENCE !!!');
      return res.status(500).json({ success: false, error: 'No reference from Payhero' });
    }

    // 5. INSERT KWA SUPABASE BAADA YA KUPATA REFERENCE YA PAYHERO
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
        checkout_id: checkout_id, // ← SASA TUNATUMIA YA PAYHERO
        payment_status: 'pending'
      });

    if (dbError) {
      console.log('!!! SUPABASE INSERT ERROR !!!', dbError.message);
      return res.status(500).json({ success: false, db_error: dbError.message });
    }
    
    console.log('PENDING ROW IMEINGIA:', checkout_id);

    // 6. RUDISHA JIBU KWA FRONTEND - TUMIA REFERENCE YA PAYHERO
    return res.status(200).json({ 
      success: true, 
      checkout_id: checkout_id, // ← HII NDIO FRONTEND ITATUMIA KU-CHECK
      CheckoutRequestID: checkout_id,
      data: data 
    });
    
  } catch (error) {
    console.log('!!! STK CRASH ERROR !!!', error.message);
    return res.status(500).json({ success: false, server_error: error.message });
  }
}
