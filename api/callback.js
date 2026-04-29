import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // 1. Jibu PayHero haraka
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });
  
  console.log('CALLBACK IMEFIKA:', JSON.stringify(req.body));
  
  if (req.method !== 'POST') return;
  
  const data = req.body;
  const payment = data.response;
  
  console.log('PAYMENT DATA:', payment);
  
  if (!payment?.MpesaReceiptNumber) {
    console.log('HAKUNA RECEIPT - INARUDI');
    return;
  }
  
  console.log('SAVING TO SUPABASE:', payment);
  
  // === ANZA KUBADILISHA HAPA ===
  try {
    console.log('BEFORE INSERT');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const insertResponse = await supabase
      .from('payments') // ← HII NDIO UTAIBADILISHA UKIPATA JINA SAHIHI
      .insert({
        amount: payment.Amount,
        phone: payment.Phone,
        mpesa_receipt: payment.MpesaReceiptNumber,
        reference: payment.ExternalReference,
      })
      .select();

    console.log('INSERT RESPONSE FULL:', JSON.stringify(insertResponse, null, 2));

    if (insertResponse.error) {
      console.error('ERROR CODE:', insertResponse.error.code);
      console.error('ERROR MESSAGE:', insertResponse.error.message);
      console.error('ERROR DETAILS:', insertResponse.error.details);
      console.error('ERROR HINT:', insertResponse.error.hint);
    } else {
      console.log('SAVED SUCCESS:', insertResponse.data);
    }

  } catch (err) {
    console.error('CRASH CAUGHT:', err.name, err.message);
  }
  // === MALIZA KUBADILISHA HAPA ===
}
