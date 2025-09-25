export default async ({ req, res, log, error }) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.json({}, 200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
  }

  // Parse URL parameters
  const url = new URL(`https://dummy.com${req.path}`);
  const searchParams = new URLSearchParams(req.query);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return res.json(
      { error: "Missing 'url' query parameter." },
      400,
      {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    );
  }

  // Basic validation to prevent SSRF
  try {
    const parsed = new URL(targetUrl);
    // Optionally: block internal/private IPs, localhost, etc.
    // For demo: allow all public http/https
    if (!/^https?:$/.test(parsed.protocol)) {
      throw new Error('Only http(s) protocols are supported.');
    }
  } catch (err) {
    return res.json(
      { error: 'Invalid URL provided.' },
      400,
      {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    );
  }

  // Realistic browser-like headers (Chrome example)
  const browserHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
  };

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: browserHeaders,
    });

    const content = await response.text();
    
    return res.send(content, response.status, {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/html; charset=UTF-8',
    });
  } catch (err) {
    error('Failed to fetch target:', err);
    return res.json(
      { error: 'Failed to fetch target: ' + (err.message || err) },
      502,
      {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    );
  }
};
