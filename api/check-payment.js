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

        return res.status(200).json({ 
            payment_status: data.payment_status, // 'paid' | 'failed' | 'pending'
            mpesa_receipt: data.mpesa_receipt || null
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Server error' });
    }
}
