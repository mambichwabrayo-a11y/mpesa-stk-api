import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export default async function handler(req, res) {
  // ZUIA CACHE - HIZI NDIO FIX KUU
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('Surrogate-Control', 'no-store')
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { checkout_id } = req.query

    if (!checkout_id) {
      return res.status(400).json({ error: 'checkout_id is required' })
    }

    const { data, error } = await supabase
      .from('payments')
      .select('payment_status, mpesa_receipt, failure_reason, amount, phone')
      .eq('checkout_id', checkout_id)
      .single()

    if (error) {
      console.error('DB ERROR:', error)
      return res.status(404).json({ error: 'Transaction not found' })
    }

    // Rudisha data fresh kila time
    return res.status(200).json(data)

  } catch (err) {
    console.error('CHECK PAYMENT ERROR:', err.message)
    return res.status(500).json({ error: 'Server error' })
  }
}
