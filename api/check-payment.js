// api/check-payment.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    const { ref } = req.query;
    if (!ref) return res.status(400).json({ error: 'Reference required' });

    try {
        const { data, error } = await supabase
            .from('payments')
            .select('payment_status, mpesa_receipt')
            .eq('checkout_id', ref)
            .single();

        if (error || !data) {
            return res.status(200).json({ payment_status: 'pending' });
        }

        // FIX KUBWA: Map 'success' kutoka DB kuwa 'paid' kwa frontend
        let frontend_status = data.payment_status;
        if (data.payment_status === 'success') {
            frontend_status = 'paid'; // Frontend yako inatafuta 'paid'
        }

        return res.status(200).json({ 
            payment_status: frontend_status, // 'paid' | 'failed' | 'pending'
            mpesa_receipt: data.mpesa_receipt || null
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
}
