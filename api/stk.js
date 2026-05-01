export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  try {
    const { phone, amount } = req.body;
    if (!phone || !amount) return res.status(400).json({ error: 'Phone and amount are required' });

    const checkout_id = 'TXN-' + Date.now();

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
        checkout_id: checkout_id,
        payment_status: 'pending'
      });

    if (dbError) {
      console.log('!!! SUPABASE INSERT ERROR !!!', dbError.message);
      return res.status(500).json({ success: false, db_error: dbError.message });
    }
    
    console.log('PENDING ROW INSERTED:', checkout_id);

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
    
    // Handle 401 Unauthorized - Credentials expired or insufficient tokens
    if (response.status === 401) {
      await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: 'Service temporarily unavailable. Please contact support.'
        })
        .eq('checkout_id', checkout_id);
      
      return res.status(400).json({ 
        success: false, 
        error: 'Payment service is temporarily unavailable. Please try again later.',
        code: 'AUTH_FAILED',
        payhero_error: data 
      });
    }

    // Handle insufficient tokens/balance
    if (data.status === 'FAILED' || data.success === false) {
      const errorMsg = data.message || data.error || 'Payment request failed';
      
      await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: errorMsg
        })
        .eq('checkout_id', checkout_id);

      if (errorMsg.toLowerCase().includes('insufficient') || 
          errorMsg.toLowerCase().includes('balance') || 
          errorMsg.toLowerCase().includes('token') ||
          errorMsg.toLowerCase().includes('credit')) {
        return res.status(400).json({ 
          success: false, 
          error: 'Payment service is temporarily unavailable. Please contact support.',
          code: 'INSUFFICIENT_TOKENS',
          payhero_error: data 
        });
      }
      
      return res.status(400).json({ 
        success: false, 
        error: errorMsg,
        code: 'PAYHERO_ERROR',
        payhero_error: data 
      });
    }

    if (!data.reference) {
      await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: 'Payment gateway did not return a reference'
        })
        .eq('checkout_id', checkout_id);
      
      return res.status(400).json({ 
        success: false, 
        error: 'Payment gateway error. Please try again.',
        code: 'NO_REFERENCE',
        payhero_error: data 
      });
    }

    return res.status(200).json({ 
      success: true, 
      checkout_id: checkout_id,
      CheckoutRequestID: checkout_id,
      data: data 
    });
    
  } catch (error) {
    console.log('!!! STK CRASH ERROR !!!', error.message);
    
    try {
      if (typeof checkout_id !== 'undefined') {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_SERVICE_KEY
        );
        await supabase
          .from('payments')
          .update({ 
            payment_status: 'failed',
            failure_reason: error.message 
          })
          .eq('checkout_id', checkout_id);
      }
    } catch (e) {
      console.log('Failed to update DB on crash:', e.message);
    }

    return res.status(500).json({ 
      success: false, 
      server_error: error.message,
      code: 'SERVER_ERROR'
    }
