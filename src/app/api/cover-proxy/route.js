// API Route: /api/cover-proxy
// Proxies album art images to avoid CORS issues on the client side
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return Response.json({ error: 'URL is required' }, { status: 400 });
  }

  // Whitelist trusted image domains
  const allowedDomains = [
    'mzstatic.com',
    'is1-ssl.mzstatic.com',
    'is2-ssl.mzstatic.com',
    'is3-ssl.mzstatic.com',
    'is4-ssl.mzstatic.com',
    'i.scdn.co',
    'genius.com',
  ];

  try {
    const parsed = new URL(url);
    const isAllowed = allowedDomains.some((d) => parsed.hostname.endsWith(d));

    if (!isAllowed) {
      return Response.json({ error: 'Domain not allowed' }, { status: 403 });
    }

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Samsung-Music-PWA/1.0' },
    });

    if (!res.ok) throw new Error(`Image fetch error: ${res.status}`);

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Cover proxy error:', err);
    return Response.json({ error: 'Failed to fetch image' }, { status: 500 });
  }
}
