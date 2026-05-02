// api/check-payment.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const { ref } = req.query;
    console.log('CHECKING REF:', ref); // DEBUG 1
    
    if (!ref) return res.status(400).json({ error: 'Reference required' });

    try {
        const { data, error } = await supabase
            .from('payments')
            .select('*') // ← BADILISHA ICHUKUE ZOTE TUONE
            .eq('checkout_id', ref)
            .single();

        console.log('DB ERROR:', error); // DEBUG 2
        console.log('DB DATA:', data); // DEBUG 3

        if (error || !data) {
            return res.status(200).json({ 
                payment_status: 'pending',
                debug: 'No data found',
                searched_ref: ref 
            });
        }

        let frontend_status = data.payment_status;
        
        if (data.payment_status === 'success' || data.payment_status === 'Success') {
            frontend_status = 'paid';
        } else if (data.payment_status === 'Cancelled' || data.payment_status === 'cancelled') {
            frontend_status = 'cancelled';
        } else if (data.payment_status === 'Failed' || data.payment_status === 'failed') {
            frontend_status = 'failed';
        }

        return res.status(200).json({ 
            payment_status: frontend_status,
            mpesa_receipt: data.mpesa_receipt || null,
            amount: data.amount || null,
            failure_reason: data.failure_reason || null,
            phone: data.phone || null,
            raw_status: data.payment_status // DEBUG 4
        });

    } catch (error) {
        console.error('CATCH ERROR:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
