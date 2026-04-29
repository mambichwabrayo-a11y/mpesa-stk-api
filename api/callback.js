export default async function handler(req, res) {
  // Jibu PayHero haraka
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });
  
  console.log('=== CALLBACK START ===');
  
  try {
    const payment = req.body.response;
    
    if (!payment?.MpesaReceiptNumber) {
      console.log('HAKUNA RECEIPT - INARUDI');
      return;
    }
    
    console.log('ENV CHECK:', {
      url: process.env.SUPABASE_URL ? 'IPO' : 'HAKUNA',
      key: process.env.SUPABASE_ANON_KEY ? 'IPO' : 'HAKUNA'
    });
    
    console.log('IMPORTING SUPABASE...');
    const { createClient } = await import('@supabase/supabase-js');
    
    console.log('CREATING CLIENT...');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    console.log('DATA YA KU-INSERT:', {
      amount: payment.Amount,
      phone: payment.Phone,
      mpesa_receipt: payment.MpesaReceiptNumber,
      reference: payment.ExternalReference
    });
    
    console.log('INSERTING TO SUPABASE...');
    const { data, error } = await supabase
      .from('payments')
      .insert({
        amount: payment.Amount,
        phone: payment.Phone,
        mpesa_receipt: payment.MpesaReceiptNumber,
        reference: payment.ExternalReference
      })
      .select();
    
    if (error) {
      console.log('!!! SUPABASE ERROR !!!');
      console.log('CODE:', error.code);
      console.log('MESSAGE:', error.message);
      console.log('DETAILS:', error.details);
    } else {
      console.log('!!! SUCCESS !!!');
      console.log('DATA:', JSON.stringify(data));
    }
    
  } catch (err) {
    console.log('!!! CRASH ERROR !!!');
    console.log('ERROR NAME:', err.name);
    console.log('ERROR MESSAGE:', err.message);
  }
  
  console.log('=== CALLBACK END ===');
}
