export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount required' });

    const checkout_id = 'TXN-' + Date.now();
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    const { error: dbError } = await supabase
      .from('payments')
      .insert({
        amount: Number(amount),
        phone: String(phone),
        checkout_id: checkout_id,
        payment_status: 'pending'
      });

    if (dbError) {
      console.log('SUPABASE INSERT ERROR:', dbError);
      return res.status(500).json({ success: false, error: dbError.message });
    }

    const auth = Buffer.from(process.env.PAYHERO_USER + ':' + process.env.PAYHERO_PASS).toString('base64');

    const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Number(amount),
        phone_number: String(phone),
        channel_id: Number(process.env.CHANNEL_ID),
        provider: 'm-pesa',
        external_reference: checkout_id
      })
    });

    const data = await response.json();
    console.log('PayHero Response:', data);
    
    if (response.status === 401 || data.success === false) {
      const errorMsg = data.message || 'Payment failed';
      await supabase.from('payments').update({ payment_status: 'Failed' }).eq('checkout_id', checkout_id);
      return res.status(400).json({ success: false, error: errorMsg });
    }

    return res.status(200).json({ success: true, checkout_id: checkout_id, data: data });
    
  } catch (error) {
    console.log('STK CRASH:', error.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}
