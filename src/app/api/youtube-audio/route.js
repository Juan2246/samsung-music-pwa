// API Route: /api/youtube-audio
// Uses yt-dlp to stream audio directly from YouTube.
// This is the absolute most reliable method to bypass bot detections.

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import YouTube from 'youtube-sr';
import { jsonError, readText } from '@/lib/server/http';

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
// Si yt-dlp no entrega el primer byte en este tiempo, algo va mal (bloqueo, red).
const FIRST_BYTE_TIMEOUT_MS = 60_000;
// Tope total por canción para no dejar procesos colgados.
const MAX_DOWNLOAD_MS = 5 * 60_000;

/**
 * Ubica el ejecutable de yt-dlp, en este orden:
 * 1. La variable de entorno YTDLP_PATH.
 * 2. yt-dlp(.exe) en la raíz del proyecto (como lo usaba la versión original).
 * 3. "yt-dlp" en el PATH del sistema.
 */
function resolveYtDlp() {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;
  const localName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const local = path.join(process.cwd(), localName);
  return existsSync(local) ? local : 'yt-dlp';
}

async function findVideoId(artist, title) {
  // Search YouTube using youtube-sr
  const query = `${artist} - ${title} official audio`;
  const results = await YouTube.search(query, { limit: 3, type: 'video' });
  return results?.[0]?.id || null;
}

/**
 * Lanza yt-dlp y espera a que haya audio en stdout antes de responder.
 * Así un fallo (yt-dlp no instalado, YouTube bloqueando) se convierte en un
 * error HTTP claro, en vez de un 200 vacío que el navegador no puede decodificar.
 */
function startYtDlp(targetUrl) {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveYtDlp(), [
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      // m4a (AAC) se decodifica en cualquier navegador; si no hay, el mejor disponible
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      // YouTube exige resolver un reto en JavaScript: se usa el mismo Node del servidor
      '--js-runtimes', `node:${process.execPath}`,
      '-o', '-', // Output to stdout
      targetUrl,
    ], { windowsHide: true });

    let stderr = '';
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(firstByteTimer);
      child.stdout.off('readable', onReadable);
      fn(value);
    };

    const firstByteTimer = setTimeout(() => {
      child.kill();
      settle(reject, new Error('yt-dlp tardó demasiado en responder'));
    }, FIRST_BYTE_TIMEOUT_MS);

    const onReadable = () => {
      if (child.stdout.readableLength > 0) settle(resolve, child);
    };

    child.stdout.on('readable', onReadable);
    child.stderr.on('data', (data) => {
      stderr = (stderr + data.toString()).slice(-2000);
    });
    // Sin este listener, un ENOENT (yt-dlp no instalado) tumba el proceso de Node.
    child.once('error', (err) => settle(reject, err));
    child.once('close', (code) => {
      if (stderr) console.error('yt-dlp stderr:', stderr.trim());
      settle(reject, new Error(lastLine(stderr) || `yt-dlp terminó con código ${code} sin entregar audio`));
    });
  });
}

function lastLine(text) {
  return text.trim().split('\n').pop()?.slice(0, 300) || '';
}

function toWebStream(child) {
  const killTimer = setTimeout(() => child.kill(), MAX_DOWNLOAD_MS);
  // Next.js Responses can natively stream from a ReadableStream
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of child.stdout) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        clearTimeout(killTimer);
      }
    },
    cancel() {
      clearTimeout(killTimer);
      child.kill();
    },
  });
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const artist = readText(searchParams, 'artist') || '';
  const title = readText(searchParams, 'title') || '';
  const rawVideoId = searchParams.get('videoId');

  if (rawVideoId && !VIDEO_ID.test(rawVideoId)) {
    return jsonError('videoId no válido', 400);
  }
  if (!rawVideoId && !(artist && title)) {
    return jsonError('Faltan artista y título, o un videoId', 400);
  }

  let videoId = rawVideoId;
  if (!videoId) {
    try {
      videoId = await findVideoId(artist, title);
    } catch (err) {
      console.error('YouTube search failed:', err.message);
      return jsonError('No se pudo buscar la canción en YouTube. Intenta de nuevo en un momento.', 502);
    }
    if (!videoId) {
      return jsonError('No se encontró la canción en YouTube', 404);
    }
  }

  try {
    const child = await startYtDlp(`https://www.youtube.com/watch?v=${videoId}`);
    return new Response(toWebStream(child), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream', // m4a o webm según lo que entregue YouTube
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error('yt-dlp no encontrado. Define YTDLP_PATH o instálalo en el PATH.');
      return jsonError('yt-dlp no está instalado en el servidor. Revisa la sección «Requisitos» del README.', 500);
    }
    console.error('yt-dlp stream error:', err.message);
    return jsonError(`YouTube no entregó el audio: ${err.message}`, 502);
  }
}
