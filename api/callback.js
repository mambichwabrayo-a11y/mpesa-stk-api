export default async function handler(req, res) {
  console.log('=== PAYHERO CALLBACK ===', JSON.stringify(req.body));
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    
    const body = req.body;
    const ResultCode = body.ResultCode ?? body.response?.ResultCode;
    const ExternalReference = body.external_reference || body.ExternalReference || body.response?.ExternalReference || body.reference;
    const MpesaReceiptNumber = body.MpesaReceiptNumber ?? body.response?.MpesaReceiptNumber;
    
    // 👈 ONGEZA HIZI LINES 3 HAPA KWA DEBUG
    console.log('EXTRACTED ExternalReference:', ExternalReference);
    console.log('EXTRACTED ResultCode:', ResultCode);
    console.log('EXTRACTED Receipt:', MpesaReceiptNumber);
    
    if (!ExternalReference) {
      console.log('ERROR: No ExternalReference');
      return res.status(200).json({ ResultCode: 0 });
    }

    let payment_status = 'Failed';
    if (ResultCode == 0) payment_status = 'success';
    if (ResultCode == 1032) payment_status = 'Cancelled';

    // 👈 ONGEZA HII LINE 1 HAPA KABLA YA UPDATE
    console.log('UPDATING SUPABASE:', { checkout_id: ExternalReference, payment_status, mpesa_receipt: MpesaReceiptNumber });

    const { data, error } = await supabase.from('payments').update({
      payment_status: payment_status,
      mpesa_receipt: MpesaReceiptNumber
    }).eq('checkout_id', ExternalReference);

    // 👈 ONGEZA HIZI LINES 2 HAPA BAADA YA UPDATE
    if (error) console.log('SUPABASE UPDATE ERROR:', error);
    else console.log('SUPABASE UPDATE SUCCESS:', data);

    res.status(200).json({ ResultCode: 0 });
  } catch (err) {
    console.error('CALLBACK ERROR:', err);
    res.status(200).json({ ResultCode: 0 });
  }
}
