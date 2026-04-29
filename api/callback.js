// api/callback.js - VERSION SAFI NA SUPABASE + ERROR HANDLING
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // 1. Jibu PayHero haraka kwanza - MUHIMU SANA
  res.status(200).json({ 
    ResultCode: 0, 
    ResultDesc: 'Received' 
  });

  // 2. Kama sio POST, toka tu
  if (req.method !== 'POST') return;

  const data = req.body;
  console.log('=== PAYHERO CALLBACK ===');
  console.log(data);
  console.log('========================');

  // 3. Jaribu ku-save kwa Supabase, lakini isicrash
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { error } = await supabase.from('payments').insert({
      amount: data.amount,
      phone: data.phone_number,
      mpesa_code: data.MpesaReceiptNumber,
      status: data.status,
      reference: data.reference,
      raw_data: data
    });

    if (error) {
      console.error('Supabase insert error:', error.message);
    } else {
      console.log('Payment saved to Supabase successfully');
    }

  } catch (error) {
    console.error('Supabase connection error:', error.message);
  }
}
