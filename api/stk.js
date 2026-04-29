export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST only' });

  const { phone, amount } = req.body;
  if (!phone || !amount) return res.status(400).json({ error: 'phone and amount required' });

  const auth = Buffer.from(${process.env.PAYHERO_USER}:${process.env.PAYHERO_PASS}).toString('base64');

  try {
    const response = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
      method: 'POST',
      headers: {
        'Authorization': Basic ${auth},
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: phone,
        amount: Number(amount),
        channel_id: Number(process.env.CHANNEL_ID),
        provider: "m-pesa",
        external_reference: 'TXN-' + Date.now(),
        callback_url: "https://webhook.site/unique-id"
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'PayHero error');
    
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
