// api/callback.js - VERSION SAFI
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const data = req.body;
  
  console.log('=== PAYHERO CALLBACK ===');
  console.log(data);
  console.log('========================');

  res.status(200).json({ 
    ResultCode: 0, 
    ResultDesc: 'Received' 
  });
}
