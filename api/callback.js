export default async function handler(req, res) {
  // 1. Jibu PayHero haraka sana
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });
  
  console.log('=== CALLBACK START ===');
  
  try {
    // 2. Chukua data kutoka kwa PayHero
    const payment = req.body.response;
    
    // 3. Kama hakuna receipt, toka
    if (!payment?.MpesaReceiptNumber) {
      console.log('HAKUNA MPESA RECEIPT - INARUDI');
      return;
    }
    
    console.log('ENV CHECK:', {
      url: process.env.SUPABASE_URL ? 'IPO' : 'HAKUNA',
      key: process.env.SUPABASE_ANON_KEY ? 'IPO' : 'HAKUNA'
    });
    
    // 4. Unda Supabase client
    console.log('IMPORTING SUPABASE...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    // 5. Tengeneza data ya ku-insert - ZOTE SASA
    const insertData = {
      amount: payment.Amount,
      phone: payment.Phone,
      mpesa_receipt: payment.MpesaReceiptNumber,
      reference: payment.ExternalReference,
      status: payment.Status, // 'Success'
      raw_data: payment // Weka response yote ya PayHero hapa
      // paid_at itajazwa na default now() kwa Supabase
    };
    
    console.log('DATA YA KU-INSERT:', JSON.stringify(insertData));
    
    // 6. INSERT KWA SUPABASE
    console.log('INSERTING TO SUPABASE...');
    const { data, error } = await supabase
      .from('payments')
      .insert(insertData)
      .select();
    
    // 7. Check kama imefaulu
    if (error) {
      console.log('!!! SUPABASE ERROR !!!');
      console.log('CODE:', error.code);
      console.log('MESSAGE:', error.message);
      console.log('DETAILS:', error.details);
      console.log('HINT:', error.hint);
    } else {
      console.log('!!! SUCCESS !!!');
      console.log('ROW ILIYOINGIA:', JSON.stringify(data));
    }
    
  } catch (err) {
    console.log('!!! CRASH ERROR !!!');
    console.log('ERROR NAME:', err.name);
    console.log('ERROR MESSAGE:', err.message);
  }
  
  console.log('=== CALLBACK END ===');
}
