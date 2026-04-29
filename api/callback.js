export default async function handler(req, res) {
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });
  
  console.log('=== CALLBACK START ===');
  console.log('METHOD:', req.method);
  console.log('BODY KAMILI:', JSON.stringify(req.body, null, 2));
  
  try {
    const body = req.body;
    
    // PayHero huweka data kwa 'response' ama direct kwa body
    const payment = body.response || body;
    
    console.log('PAYMENT OBJECT:', JSON.stringify(payment, null, 2));
    
    // Check kama hii ni callback ya Success
    if (!payment?.MpesaReceiptNumber) {
      console.log('HAKUNA MPESA RECEIPT - HII SIO CALLBACK YA MALIPO');
      console.log('ResultCode:', payment?.ResultCode);
      console.log('ResultDesc:', payment?.ResultDesc);
      return;
    }
    
    console.log('MPESA RECEIPT IMEPATIKANA:', payment.MpesaReceiptNumber);
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const insertData = {
      amount: payment.Amount,
      phone: payment.Phone || payment.MSISDN || payment.PhoneNumber,
      mpesa_receipt: payment.MpesaReceiptNumber,
      reference: payment.ExternalReference || payment.BillRefNumber,
      status: payment.Status || payment.ResultDesc,
      raw_data: body // Weka body yote
    };
    
    console.log('DATA YA KU-INSERT:', JSON.stringify(insertData));
    
    console.log('INSERTING TO SUPABASE...');
    const { data, error } = await supabase
      .from('payments')
      .insert(insertData)
      .select();
    
    if (error) {
      console.log('!!! SUPABASE ERROR !!!');
      console.log('CODE:', error.code);
      console.log('MESSAGE:', error.message);
      console.log('DETAILS:', error.details);
    } else {
      console.log('!!! SUCCESS !!! ROW IMEINGIA:');
      console.log(JSON.stringify(data));
    }
    
  } catch (err) {
    console.log('!!! CRASH ERROR !!!');
    console.log('ERROR:', err.message);
  }
  
  console.log('=== CALLBACK END ===');
}
