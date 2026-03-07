// API Route: /api/youtube-audio
// Uses yt-dlp.exe to stream audio directly from YouTube.
// This is the absolute most reliable method to bypass bot detections.

import { spawn } from 'child_process';
import path from 'path';
import YouTube from 'youtube-sr';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const artist  = searchParams.get('artist') || '';
  const title   = searchParams.get('title')  || '';
  const videoId = searchParams.get('videoId') || null;

  if (!artist && !title && !videoId) {
    return Response.json({ error: 'artist+title or videoId required' }, { status: 400 });
  }

  try {
    let targetUrl;

    if (videoId) {
      targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    } else {
      // Search YouTube using youtube-sr
      const query = `${artist} - ${title} official audio`;
      const results = await YouTube.search(query, { limit: 3, type: 'video' });

      if (!results || results.length === 0) {
        return Response.json({ error: 'No YouTube results found' }, { status: 404 });
      }

      targetUrl = `https://www.youtube.com/watch?v=${results[0].id}`;
    }

    // Path to our locally downloaded yt-dlp.exe
    const ytdlpPath = path.resolve(process.cwd(), 'yt-dlp.exe');

    // Spawn yt-dlp to stream highest quality audio stdout
    const ytProcess = spawn(ytdlpPath, [
      targetUrl,
      '-f', 'bestaudio', // Download best audio format
      '-o', '-',         // Output to stdout
      '--quiet',         // No logs to stdout
      '--no-warnings'
    ]);

    // Create an async iterator from the Node.js Readable stream
    // Next.js Responses can natively stream from AsyncIterables
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of ytProcess.stdout) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        ytProcess.kill();
      }
    });

    ytProcess.stderr.on('data', (data) => {
      console.error('yt-dlp stderr:', data.toString());
    });

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'audio/webm', // Generic audio type for the stream
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });

  } catch (err) {
    console.error('yt-dlp stream error:', err.message);
    return Response.json({ error: err.message || 'YouTube audio failed' }, { status: 500 });
  }
}
