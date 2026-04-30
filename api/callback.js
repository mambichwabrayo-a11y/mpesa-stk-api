export default async function handler(req, res) {
  // Jibu M-Pesa haraka
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Received' });
  
  console.log('=== CALLBACK START ===');
  
  try {
    const body = req.body;
    const payment = body.response || body;
    
    console.log('PAYMENT OBJECT:', JSON.stringify(payment, null, 2));
    
    // Check kama malipo yamefaulu
    if (!payment?.MpesaReceiptNumber) {
      console.log('HAKUNA MPESA RECEIPT - Payment failed/cancelled');
      console.log('ResultCode:', payment?.ResultCode);
      console.log('ResultDesc:', payment?.ResultDesc);
      return;
    }
    
    console.log('MPESA RECEIPT IMEPATIKANA:', payment.MpesaReceiptNumber);
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY  // ← SERVICE_KEY, sio ANON_KEY
    );
    
    const checkoutRef = payment.ExternalReference || payment.BillRefNumber || payment.CheckoutRequestID;
    
    console.log('UPDATING checkout_id:', checkoutRef);
    
    // UPDATE ROW ILIOPO badala ya INSERT mpya
    const { data, error } = await supabase
      .from('payments')
      .update({
        payment_status: 'paid',  // ← column sahihi
        mpesa_receipt: payment.MpesaReceiptNumber,
        raw_data: body
      })
      .eq('checkout_id', checkoutRef)  // ← tafuta row na checkout_id hii
      .select();
    
    if (error) {
      console.log('!!! SUPABASE UPDATE ERROR !!!');
      console.log('MESSAGE:', error.message);
    } else if (data.length === 0) {
      console.log('!!! WARNING !!! Hakuna row ilipatikana na checkout_id:', checkoutRef);
    } else {
      console.log('!!! SUCCESS !!! ROW IME-UPDATE:');
      console.log(JSON.stringify(data));
    }
    
  } catch (err) {
    console.log('!!! CRASH ERROR !!!');
    console.log('ERROR:', err.message);
  }
  
  console.log('=== CALLBACK END ===');
}
