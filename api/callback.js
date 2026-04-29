import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  // 1. Jibu PayHero haraka
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });
  
  console.log('CALLBACK IMEFIKA:', JSON.stringify(req.body));
  
  // 2. Chukua data
  if (req.method !== 'POST') return;
  
  const data = req.body;
  const payment = data.response;
  
  console.log('PAYMENT DATA:', payment);
  
  // 3. Hakikisha payment iko sawa
  if (!payment?.MpesaReceiptNumber) {
    console.log('HAKUNA RECEIPT - INARUDI');
    return;
  }
  
  console.log('SAVING TO SUPABASE:', payment);
  
  // 4. HAPA NDIPO createClient INAKUWA
  try {
    console.log('URL IKO:', process.env.SUPABASE_URL ? 'YES' : 'NO');
    console.log('KEY IKO:', process.env.SUPABASE_ANON_KEY ? 'YES' : 'NO');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: result, error } = await supabase.from('payments').insert({
      amount: payment.Amount,
      phone: payment.Phone,
      mpesa_receipt: payment.MpesaReceiptNumber,
      status: payment.Status,
      reference: payment.ExternalReference,
      raw_data: data
    }).select();

    console.log('INSERT RESULT:', result);
    console.log('INSERT ERROR:', JSON.stringify(error));
    
    if (error) console.error('SUPABASE ERROR FULL:', error);
    else console.log('SAVED SUCCESS:', payment.MpesaReceiptNumber);

  } catch (error) {
    console.error('CRASH ERROR:', error.message);
  }
}
