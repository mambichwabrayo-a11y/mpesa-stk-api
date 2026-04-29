export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST only' });
  }

  try {
    const { phone, amount } = req.body;
    
    if (!phone || !amount) {
      return res.status(400).json({ error: 'phone and amount required' });
    }

    if (!process.env.PAYHERO_USER || !process.env.PAYHERO_PASS || !process.env.CHANNEL_ID) {
      return res.status(500).json({ error: 'Missing environment variables' });
    }

    const auth = Buffer.from(process.env.PAYHERO_USER + ':' + process.env.PAYHERO_PASS).toString('base64');

    const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: String(phone),
        amount: Number(amount),
        channel_id: Number(process.env.CHANNEL_ID),
        provider: 'm-pesa',
        external_reference: 'TXN-' + Date.now()
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(400).json({ success: false, error: data.message || 'PayHero error' });
    }
    
    return res.status(200).json({ success: true, data: data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
