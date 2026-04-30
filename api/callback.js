import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // 1. LOG KILA KITU PAYHERO ANATUMA
  console.log('=== PAYHERO CALLBACK RAW ===');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('=== END CALLBACK ===');

  // 2. Jibu PayHero haraka ndio asikate
  res.status(200).json({ ResultCode: 0, ResultDesc: "Received" });

  // 3. Jaribu ku-update - tuta-check field names zote possible
  try {
    const body = req.body;
    
    // PayHero anaweza tuma hizi field tofauti
    const checkoutID = body.CheckoutRequestID || body.external_reference || body.reference || body.request_id;
    const receipt = body.MpesaReceiptNumber || body.receipt || body.transaction_id;
    const status = body.status || body.Status;
    
    console.log('Parsed:', { checkoutID, receipt, status });

    if (status === 'success' || status === 'Success' || status === 'SUCCESS') {
      const { error } = await supabase
        .from('payments')
        .update({
          payment_status: 'paid',
          mpesa_receipt: receipt,
          updated_at: new Date().toISOString()
        })
        .eq('checkout_id', checkoutID);

      if (error) {
        console.log('SUPABASE UPDATE ERROR:', error);
      } else {
        console.log('SUCCESS: Updated', checkoutID);
      }
    } else {
      console.log('Payment not success:', status);
    }

  } catch (e) {
    console.log('CALLBACK CRASH:', e.message);
  }
}
