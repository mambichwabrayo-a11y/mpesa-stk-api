export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  // CHECK ENV VARS
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || 
      !process.env.PAYHERO_USER || !process.env.PAYHERO_PASS || !process.env.CHANNEL_ID) {
    console.error('Missing environment variables');
    return res.status(500).json({ 
      success: false, 
      error: 'Server configuration error. Please contact support.',
      code: 'ENV_MISSING'
    });
  }

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount are required' });

    const checkout_id = 'TXN-' + Date.now();

    // 1. TUMA STK KWA PAYHERO KWANZA - HARAKA SANA
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
    
    // 2. CHECK ERRORS ZA PAYHERO
    if (response.status === 401) {
      return res.status(400).json({ 
        success: false, 
        error: 'PayHero authentication failed. Please contact support.',
        code: 'AUTH_FAILED'
      });
    }

    if (data.status === 'FAILED' || data.success === false) {
      const errorMsg = data.message || data.error || 'Payment request failed';
      
      if (errorMsg.toLowerCase().includes('insufficient') || 
          errorMsg.toLowerCase().includes('balance') || 
          errorMsg.toLowerCase().includes('token') ||
          errorMsg.toLowerCase().includes('credit') ||
          errorMsg.toLowerCase().includes('quota')) {
        return res.status(400).json({ 
          success: false, 
          error: 'PayHero tokens depleted. Please top up your account.',
          code: 'INSUFFICIENT_TOKENS'
        });
      }
      
      return res.status(400).json({ 
        success: false, 
        error: errorMsg,
        code: 'PAYHERO_ERROR'
      });
    }

    if (!data.reference) {
      return res.status(400).json({ 
        success: false, 
        error: 'Payment gateway error. Please try again.',
        code: 'NO_REFERENCE'
      });
    }

    // 3. RUDISHA RESPONSE KWA USER MARA MOJA - HAPA NDIO STK INATOKA HARAKA
    res.status(200).json({ 
      success: true, 
      checkout_id: checkout_id,
      CheckoutRequestID: checkout_id,
      data: data 
    });

    // 4. SASA NDIO SAVE KWA SUPABASE - USER HASHANGII
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    await supabase
      .from('payments')
      .insert({
        amount: Number(amount),
        phone: String(phone),
        checkout_id: checkout_id,
        payment_status: 'pending'
      });
    
  } catch (error) {
    console.log('!!! STK CRASH ERROR !!!', error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error occurred. Please try again.',
      code: 'SERVER_ERROR'
    });
  }
}
