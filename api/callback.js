import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.status(200).json({ 
    ResultCode: 0, 
    ResultDesc: 'Received' 
  });

  if (req.method !== 'POST') return;

  const data = req.body;
  console.log('PAYHERO CALLBACK:', JSON.stringify(data));

  // FIX #1: TOA DATA NDANI YA 'response'
  const payment = data.response;
  
  if (!payment) {
    console.log('No payment object in callback');
    return;
  }
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    console.log('SAVING TO SUPABASE:', payment);

    // FIX #2: TUMIA MAJINA KUBWA KAMA PAYHERO
    const { data: result, error } = await supabase.from('payments').insert({
      amount: payment.Amount,
      phone: payment.Phone,
      mpesa_receipt: payment.MpesaReceiptNumber,
      status: payment.Status,
      reference: payment.ExternalReference,
      raw_data: data
    });

    if (error) {
      console.error('SUPABASE ERROR:', JSON.stringify(error));
    } else {
      console.log('SUPABASE SUCCESS:', result);
    }

  } catch (error) {
    console.error('CONNECTION ERROR:', error.message);
  }
}
