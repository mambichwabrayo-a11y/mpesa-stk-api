// api/check-payment.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    // 1. ZUIA CACHE - MUHIMU SANA
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('Surrogate-Control', 'no-store')
    
    // 2. CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const { ref } = req.query;
    
    if (!ref) return res.status(400).json({ error: 'Reference required' });

    try {
        // 3. TAFTA KWA checkout_id - HII NDIO COLUMN YAKO
        const { data, error } = await supabase
            .from('payments')
            .select('*')
            .eq('checkout_id', ref)
            .single();

        // 4. KAMA HAKUNA DATA
        if (error || !data) {
            return res.status(200).json({ 
                payment_status: 'pending'
            });
        }

        // 5. BADILISHA STATUS ILI FRONTEND IELEWE
        let frontend_status = data.payment_status;
        
        if (data.payment_status === 'Success' || data.payment_status === 'success') {
            frontend_status = 'paid';
        } else if (data.payment_status === 'Cancelled' || data.payment_status === 'cancelled') {
            frontend_status = 'Cancelled'; // Capital C kama callback yako
        } else if (data.payment_status === 'Failed' || data.payment_status === 'failed') {
            frontend_status = 'Failed';
        }

        // 6. RUDISHA RESPONSE
        return res.status(200).json({ 
            payment_status: frontend_status,
            mpesa_receipt: data.mpesa_receipt || null,
            amount: data.amount || null,
            failure_reason: data.failure_reason || null,
            phone: data.phone || null
        });

    } catch (error) {
        console.error('Check Payment Error:', error);
        return res.status(500).json({ error: 'Server error' });
    }
}
