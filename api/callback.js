export default async function handler(req, res) {
  
  // === PART 1: FRONTEND INACHEK STATUS ===
  if (req.method === 'GET') {
    const { reference } = req.query;
    
    if (!reference) {
      return res.status(400).json({ error: 'No reference provided' });
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('checkout_id', reference)
        .single();

      if (error || !data) {
        return res.status(200).json({ status: 'PENDING' });
      }

      // Convert status to frontend format
      let status = 'PENDING';
      if (data.payment_status === 'success' || data.result_code === 0) {
        status = 'SUCCESS';
      } else if (data.payment_status === 'Failed' || data.payment_status === 'Cancelled' || data.result_code === 1 || data.result_code === 1032) {
        status = 'FAILED';
      }

      return res.status(200).json({
        status: status,
        mpesa_receipt_number: data.mpesa_receipt,
        MpesaReceiptNumber: data.mpesa_receipt,
        receipt: data.mpesa_receipt,
        amount: data.amount,
        Amount: data.amount,
        ResultCode: data.result_code
      });

    } catch (err) {
      console.error('GET STATUS ERROR:', err);
      return res.status(200).json({ status: 'PENDING' });
    }
  }

  // === PART 2: PAYHERO CALLBACK - YAKO ORIGINAL ===
  if (req.method === 'POST') {
    console.log('=== PAYHERO CALLBACK ===', JSON.stringify(req.body));
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      
      const body = req.body;
      
      const ResultCode = body.ResultCode ?? body.response?.ResultCode ?? body.result_code;
      const ExternalReference = body.external_reference || body.ExternalReference || body.response?.ExternalReference || body.reference || body.checkout_id;
      const MpesaReceiptNumber = body.MpesaReceiptNumber ?? body.response?.MpesaReceiptNumber ?? body.mpesa_receipt ?? body.transaction_code ?? body.TransID;
      const Amount = body.Amount ?? body.response?.Amount ?? body.amount;
      
      if (!ExternalReference) {
        console.log('ERROR: No ExternalReference found');
        return res.status(200).json({ ResultCode: 0 });
      }

      let payment_status = 'Failed';
      let result_code = 1;
      
      if (ResultCode == 0) {
        payment_status = 'success';
        result_code = 0;
      } else if (ResultCode == 1032) {
        payment_status = 'Cancelled';
        result_code = 1032;
      }

      const { error } = await supabase
        .from('payments')
        .update({
          payment_status: payment_status,
          result_code: result_code,
          mpesa_receipt: MpesaReceiptNumber || null,
          amount: Amount || null,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_id', ExternalReference);

      if (error) {
        console.error('SUPABASE UPDATE ERROR:', error);
      } else {
        console.log(`Payment updated: ${ExternalReference} -> ${payment_status}`);
      }

      res.status(200).json({ ResultCode: 0, ResultDesc: "Success" });

    } catch (err) {
      console.error('CALLBACK ERROR:', err);
      res.status(200).json({ ResultCode: 0 });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
