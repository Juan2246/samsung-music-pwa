// API Route: /api/lyrics
// Ultra Lyrics Engine: LRCLIB (Primary) -> Lyrics.ovh (Fallback)
// Cleans synced lyrics (LRC) timestamps to plain text for USLT compatibility.

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const artist = searchParams.get('artist');
  const title = searchParams.get('title');

  if (!artist || !title) {
    return Response.json({ error: 'artist and title are required' }, { status: 400 });
  }

  try {
    // 1. Primary Engine: LRCLIB
    const lrclibUrl = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}`;
    const lrclibRes = await fetch(lrclibUrl, {
      headers: { 'User-Agent': 'SamsungMusicPWA/1.0.0 (https://github.com/user/samsung-music-pwa)' }
    });

    if (lrclibRes.ok) {
      const lrclibData = await lrclibRes.json();
      if (lrclibData && lrclibData.length > 0) {
        const bestMatch = lrclibData[0];
        
        let finalLyrics = null;

        if (bestMatch.plainLyrics) {
          finalLyrics = bestMatch.plainLyrics;
        } else if (bestMatch.syncedLyrics) {
          // If only synced lyrics exist, strip the [mm:ss.xx] timestamps
          finalLyrics = bestMatch.syncedLyrics
            .split('\n')
            .map(line => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim())
            .join('\n');
        }

        if (finalLyrics) {
          return Response.json({ lyrics: finalLyrics, source: 'LRCLIB' });
        }
      }
    }

    // 2. Fallback Engine: Lyrics.ovh
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
    const ovhRes = await fetch(ovhUrl);

    if (ovhRes.ok) {
      const ovhData = await ovhRes.json();
      if (ovhData.lyrics) {
        // Remove the standard lyrics.ovh exact phrase disclaimer if present
        let cleanLyrics = ovhData.lyrics.replace(/Paroles de la chanson.*\n/i, '').trim();
        return Response.json({ lyrics: cleanLyrics, source: 'Lyrics.ovh' });
      }
    }

    // Both engines failed
    return Response.json({ error: 'Lyrics not found' }, { status: 404 });

  } catch (err) {
    console.error('Lyrics API Error:', err.message);
    return Response.json({ error: 'Internal server error fetching lyrics' }, { status: 500 });
  }
}
