export default async function handler(req, res) {
  // CORS Headers - LAZIMA ZIKUE HAPA JUU KABISA
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    console.log('STK Request Body:', req.body);
    
    const { phone, amount } = req.body;
    
    // Validate inputs
    if (!phone || !amount) {
      return res.status(400).json({ success: false, error: 'Phone and amount required' });
    }

    // Validate env vars
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.error('Missing Supabase env vars');
      return res.status(500).json({ success: false, error: 'Server config error' });
    }

    if (!process.env.PAYHERO_USER || !process.env.PAYHERO_PASS || !process.env.CHANNEL_ID) {
      console.error('Missing PayHero env vars');
      return res.status(500).json({ success: false, error: 'Payment config error' });
    }

    const checkout_id = 'TXN-' + Date.now();
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Insert to Supabase
    const { error: insertError } = await supabase.from('payments').insert({
      amount: Number(amount),
      phone: String(phone),
      checkout_id: checkout_id,
      payment_status: 'pending',
      created_at: new Date().toISOString()
    });

    if (insertError) {
      console.error('SUPABASE INSERT ERROR:', insertError);
      return res.status(500).json({ success: false, error: 'Database error' });
    }

    // Send to PayHero
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
        external_reference: checkout_id,
        callback_url: 'https://mpesa-stk-api.vercel.app/api/callback'
      })
    });

    const data = await response.json();
    console.log('PayHero Response:', data);
    
    if (data.success === false || data.Success === 'False') {
      await supabase.from('payments').update({ payment_status: 'Failed' }).eq('checkout_id', checkout_id);
      return res.status(400).json({ success: false, error: data.message || 'STK failed' });
    }

    // Success - rudisha checkout_id
    return res.status(200).json({ 
      success: true, 
      checkout_id: checkout_id,
      message: 'STK sent successfully'
    });
    
  } catch (error) {
    console.error('STK ERROR:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
