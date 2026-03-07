// API Route: /api/audio-stream
// Streams the 30s iTunes preview audio — proxied server-side to fix CORS
// The full MP3 file is fetched server-side and returned as a binary response
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const previewUrl = searchParams.get('url');

  if (!previewUrl) {
    return Response.json({ error: 'Preview URL required' }, { status: 400 });
  }

  // Only allow Apple CDN URLs
  const isApple =
    previewUrl.includes('audio-ssl.itunes.apple.com') ||
    previewUrl.includes('aod.itunes.apple.com') ||
    previewUrl.includes('a1.mzstatic.com') ||
    previewUrl.includes('audio.itunes.apple.com');

  if (!isApple) {
    return Response.json({ error: 'Only Apple CDN URLs are allowed' }, { status: 403 });
  }

  try {
    const res = await fetch(previewUrl, {
      headers: {
        'User-Agent': 'iTunes/12.12 (Macintosh; OS X 10.13.6)',
        Range: 'bytes=0-',
      },
    });

    if (!res.ok) throw new Error(`Audio fetch error: ${res.status}`);

    const buffer = await res.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.byteLength.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Audio stream error:', err);
    return Response.json({ error: 'Failed to fetch audio' }, { status: 500 });
  }
}
