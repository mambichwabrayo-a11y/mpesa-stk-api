export default async function handler(req, res) {
  // Log kila kitu PayHero anatuma
  console.log('=== PAYHERO CALLBACK RECEIVED ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    const body = req.body;
    
    // PayHero hutuma data kwa njia 3 tofauti. Shika zote:
    const ResultCode = body.ResultCode ?? body.response?.ResultCode ?? body.response?.ResultCode;
    const ResultDesc = body.ResultDesc ?? body.response?.ResultDesc ?? 'No description';
    const ExternalReference = 
      body.external_reference || 
      body.ExternalReference || 
      body.response?.ExternalReference ||
      body.response?.external_reference ||
      body.reference;
    
    const MpesaReceiptNumber = body.MpesaReceiptNumber ?? body.response?.MpesaReceiptNumber;
    const Amount = body.Amount ?? body.response?.Amount;
    
    console.log('EXTRACTED:', { ResultCode, ResultDesc, ExternalReference });

    if (!ExternalReference) {
      console.log('ERROR: No ExternalReference found');
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    // Update status
    let payment_status = 'Failed';
    if (ResultCode == 0) payment_status = 'success';
    if (ResultCode == 1032) payment_status = 'Cancelled';
    
    console.log('Updating to:', payment_status);

    const { data, error } = await supabase
      .from('payments')
      .update({
        payment_status: payment_status,
        mpesa_receipt: MpesaReceiptNumber,
        failure_reason: ResultDesc,
        amount: Amount
      })
      .eq('checkout_id', ExternalReference)
      .select();

    if (error) {
      console.log('SUPABASE ERROR:', error);
    } else {
      console.log('SUPABASE UPDATED:', data);
    }

    res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

  } catch (err) {
    console.error('CALLBACK ERROR:', err);
    res.status(200).json({ ResultCode: 0, ResultDesc: 'Error but accepted' });
  }
}
