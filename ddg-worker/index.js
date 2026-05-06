const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
];

function randomUA() {
  return UAS[Math.floor(Math.random() * UAS.length)];
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function getVqd(q, ua) {
  // Try the lightweight token API endpoint first
  const tokenRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(q)}&ia=images`,
    {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    }
  );

  const html = await tokenRes.text();
  const cookie = tokenRes.headers.get('set-cookie') ?? '';

  // Try multiple patterns — DDG has changed how it embeds the token over time
  const patterns = [
    /vqd=["']?([^&"'\s]+)["']?/,
    /vqd%3D([^&"'\s%]+)/,
    /"vqd"\s*:\s*"([^"]+)"/,
    /vqd=([^&]+)&/,
  ];

  for (const pat of patterns) {
    const m = html.match(pat);
    if (m?.[1]) return { vqd: decodeURIComponent(m[1]), cookie };
  }

  // Fallback: try the image-specific URL
  const imgPageRes = await fetch(
    `https://duckduckgo.com/?q=${encodeURIComponent(q)}&iax=images&ia=images`,
    {
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://duckduckgo.com/',
      },
      redirect: 'follow',
    }
  );
  const html2 = await imgPageRes.text();
  const cookie2 = imgPageRes.headers.get('set-cookie') ?? cookie;

  for (const pat of patterns) {
    const m = html2.match(pat);
    if (m?.[1]) return { vqd: decodeURIComponent(m[1]), cookie: cookie2 };
  }

  throw new Error('DuckDuckGo: could not extract vqd token');
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const { searchParams } = new URL(request.url);
    const q     = searchParams.get('q') ?? '';
    const count = Math.min(Number(searchParams.get('count') ?? '6'), 20);

    if (!q.trim()) {
      return Response.json({ images: [] }, { headers: CORS });
    }

    const ua = randomUA();
    let lastErr = null;

    // Retry up to 3 times with backoff
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(600 * attempt);

      try {
        const { vqd, cookie } = await getVqd(q, ua);

        const imgRes = await fetch(
          `https://duckduckgo.com/i.js?q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&o=json&p=1&s=0&u=bing&f=,,,,,&l=us-en`,
          {
            headers: {
              'User-Agent': ua,
              'Accept': 'application/json, text/javascript, */*; q=0.01',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://duckduckgo.com/',
              'X-Requested-With': 'XMLHttpRequest',
              ...(cookie ? { Cookie: cookie } : {}),
            },
          }
        );

        if (!imgRes.ok) throw new Error(`DuckDuckGo Images error ${imgRes.status}`);

        const data = await imgRes.json();
        const images = (data.results ?? []).slice(0, count).map(r => ({
          title:     r.title     || q,
          thumb:     r.thumbnail || r.image || '',
          full:      r.image     || r.thumbnail || '',
          sourceUrl: r.url       || '',
        }));

        return Response.json({ images }, { headers: CORS });
      } catch (err) {
        lastErr = err;
      }
    }

    return Response.json(
      { error: lastErr instanceof Error ? lastErr.message : 'Search failed' },
      { status: 500, headers: CORS }
    );
  },
};
