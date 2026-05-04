export default async function handler(req, res) {
  // Ruhusu CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const { checkoutRequestID } = req.query;

  if(!checkoutRequestID){
    return res.status(400).json({ error: 'CheckoutRequestID required' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Soma payment kutoka Supabase
    const { data: payment, error } = await supabase
      .from('payments')
      .select('payment_status, mpesa_receipt, amount')
      .eq('checkout_id', checkoutRequestID)
      .single();

    if(error || !payment){
      return res.json({ 
        status: 'pending', 
        ResultCode: null,
        MpesaReceiptNumber: null 
      });
    }

    // Convert payment_status to ResultCode
    let ResultCode = null;
    if(payment.payment_status === 'success') ResultCode = 0;
    if(payment.payment_status === 'Cancelled') ResultCode = 1032;
    if(payment.payment_status === 'Failed') ResultCode = 1;

    res.json({
      status: payment.payment_status,
      ResultCode: ResultCode,
      MpesaReceiptNumber: payment.mpesa_receipt,
      Amount: payment.amount
    });

  } catch (err) {
    console.error('STATUS ERROR:', err);
    res.status(500).json({ error: 'Server error' });
  }
}
