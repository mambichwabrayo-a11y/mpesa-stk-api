// api/callback.js - FIXED COLUMN NAMES
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.status(200).json({ 
    ResultCode: 0, 
    ResultDesc: 'Received' 
  });

  if (req.method !== 'POST') return;

  const data = req.body;
  console.log('=== PAYHERO CALLBACK DATA ===');
  console.log(JSON.stringify(data, null, 2));
  console.log('=============================');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // NIME-BADILISHA MAJINA KUFANANA NA TABLE YAKO
    const { data: result, error } = await supabase.from('payments').insert({
      amount: data.amount,
      phone: data.phone_number,
      mpesa_receipt: data.MpesaReceiptNumber, // BADILISHA HAPA
      status: data.status,
      reference: data.reference,
      raw_data: data
    });

    if (error) {
      console.error('Supabase INSERT ERROR:', error);
    } else {
      console.log('Payment saved successfully:', result);
    }

  } catch (error) {
    console.error('Supabase CONNECTION ERROR:', error.message);
  }
}
