// API Route: /api/cover-proxy
// Proxies album art images to avoid CORS issues on the client side
// (the canvas that resizes the cover for the APIC tag needs same-origin pixels).
import { fetchWithTimeout, jsonError } from '@/lib/server/http';

// Solo se aceptan CDNs de portadas conocidos. Se compara el hostname exacto o
// un subdominio real (".mzstatic.com"), nunca con includes()/endsWith() a secas,
// para que "evilmzstatic.com" o "mzstatic.com.attacker.net" no pasen.
const EXACT_HOSTS = new Set([
  'i.scdn.co', // Spotify (portadas de álbum)
  'mosaic.scdn.co', // Spotify (mosaicos de playlist)
  'i.ytimg.com', // miniaturas de YouTube
  'lh3.googleusercontent.com', // portadas de YouTube Music
  'yt3.googleusercontent.com',
  'yt3.ggpht.com',
]);
const SUFFIX_HOSTS = [
  '.mzstatic.com', // iTunes / Apple Music (is1-ssl.mzstatic.com, etc.)
  '.spotifycdn.com', // Spotify (image-cdn-ak.spotifycdn.com, etc.)
  '.ytimg.com', // i1.ytimg.com, i9.ytimg.com...
];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function isAllowedImageUrl(parsed) {
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password || parsed.port) return false;
  const host = parsed.hostname.toLowerCase();
  return EXACT_HOSTS.has(host) || SUFFIX_HOSTS.some((suffix) => host.endsWith(suffix));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return jsonError('Falta el parámetro url', 400);
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return jsonError('URL de imagen no válida', 400);
  }

  if (!isAllowedImageUrl(parsed)) {
    return jsonError('Dominio de imagen no permitido', 403);
  }

  try {
    const res = await fetchWithTimeout(parsed.href, {
      headers: { 'User-Agent': 'Samsung-Music-PWA/1.0' },
      // Una redirección podría llevar a un host fuera de la lista: se rechaza.
      redirect: 'error',
    });

    if (!res.ok) throw new Error(`Image fetch error: ${res.status}`);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return jsonError('La URL no devolvió una imagen', 415);
    }

    const declaredLength = Number(res.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      return jsonError('La imagen es demasiado grande', 413);
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return jsonError('La imagen es demasiado grande', 413);
    }

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('Cover proxy error:', err.message);
    return jsonError('No se pudo obtener la portada', 502);
  }
}
