export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  // CHECK ENV VARS KWANZA - HII INAZUIA CRASH
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
        code: 'AUTH_FAILED'
      });
    }

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
        code: 'NO_REFERENCE'
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
    
    return res.status(500).json({ 
      success: false, 
      error: 'Server error occurred. Please try again.',
      code: 'SERVER_ERROR'
    });
  }
}
backend.payhero.co.ke
backend.payhero.co.ke
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    console.log('=== PAYHERO CALLBACK RECEIVED ===')
    console.log('FULL BODY:', JSON.stringify(req.body, null, 2))

    const { status, response, reference, external_reference } = req.body
    const ExternalReference = response?.ExternalReference || external_reference || reference

    console.log('EXTRACTED ExternalReference:', ExternalReference)

    if (!ExternalReference) {
      console.log('ERROR: Missing ExternalReference - Cannot update DB')
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'No reference' })
    }

    const { MpesaReceiptNumber, ResultCode, ResultDesc, Amount, Phone } = response || req.body
    console.log('ResultCode:', ResultCode, 'Status:', status)
    console.log('MpesaReceiptNumber:', MpesaReceiptNumber)

    const isSuccess = (status === true || status === 'success') && (ResultCode === 0 || ResultCode === '0')

    if (isSuccess) {
      console.log('ATTEMPTING SUCCESS UPDATE FOR:', ExternalReference)

      const { data, error } = await supabase
        .from('payments')
        .update({
          payment_status: 'success',
          mpesa_receipt: MpesaReceiptNumber,
          amount: Amount,
          phone: Phone
        })
        .eq('checkout_id', ExternalReference)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'DB error but accepted' })
      }

      console.log('SUCCESS: DB UPDATED. Rows affected:', data?.length, 'Data:', data)

    } else {
      console.log('ATTEMPTING FAILED UPDATE FOR:', ExternalReference, 'Reason:', ResultDesc)
      
      const { data, error } = await supabase
        .from('payments')
        .update({ 
          payment_status: 'failed',
          failure_reason: ResultDesc || 'Transaction failed'
        })
        .eq('checkout_id', ExternalReference)
        .select()

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error)
      } else {
        console.log('FAILED: DB UPDATED. Rows affected:', data?.length)
      }
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' })

  } catch (err) {
    console.error('CALLBACK CRASH:', err.message, err.stack)
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Server error but accepted' })
  }
}
