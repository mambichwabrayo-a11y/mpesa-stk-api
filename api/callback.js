export default async function handler(req, res) {
  
  // PART 1: FRONTEND INACHEK STATUS HAPA - HII NDIO ILIKOSA
  if (req.method === 'GET') {
    const { reference } = req.query;
    
    if (!reference) {
      return res.status(400).json({ error: 'No reference provided' });
    }

    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      
      // Tafuta payment kwa Supabase
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('checkout_id', reference)
        .single();

      if (error || !data) {
        console.log('Payment not found:', reference);
        return res.status(200).json({ status: 'PENDING' });
      }

      console.log('Status Check:', reference, data.payment_status);

      // Rudisha format ambayo frontend inaelewa
      return res.status(200).json({
        status: data.payment_status === 'success' ? 'SUCCESS' : data.payment_status,
        receipt: data.mpesa_receipt,
        amount: data.amount,
        ResultCode: data.result_code
      });

    } catch (err) {
      console.error('GET STATUS ERROR:', err);
      return res.status(200).json({ status: 'PENDING' });
    }
  }

  // PART 2: PAYHERO INATUMA CALLBACK HAPA - YAKO IKO SAWA
  if (req.method === 'POST') {
    console.log('=== PAYHERO CALLBACK ===', JSON.stringify(req.body));
    
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
      
      const body = req.body;
      
      // PayHero formats zote
      const ResultCode = body.ResultCode ?? body.response?.ResultCode ?? body.result_code;
      const ExternalReference = body.external_reference || body.ExternalReference || body.response?.ExternalReference || body.reference || body.checkout_id;
      const MpesaReceiptNumber = body.MpesaReceiptNumber ?? body.response?.MpesaReceiptNumber ?? body.mpesa_receipt;
      const Amount = body.Amount ?? body.response?.Amount ?? body.amount;
      
      if (!ExternalReference) {
        console.log('ERROR: No ExternalReference found');
        return res.status(200).json({ ResultCode: 0 });
      }

      // Determine status
      let payment_status = 'Failed';
      let result_code = 1;
      
      if (ResultCode == 0) {
        payment_status = 'success';
        result_code = 0;
      } else if (ResultCode == 1032) {
        payment_status = 'Cancelled';
        result_code = 1032;
      }

      // Update Supabase
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
