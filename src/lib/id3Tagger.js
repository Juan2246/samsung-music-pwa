/**
 * id3Tagger.js
 * Full pipeline: YouTube audio (M4A/WebM) → MP3 (via AudioContext + lamejs) → ID3 tags (browser-id3-writer)
 *
 * The audio that yt-dlp delivers is AAC/M4A (or Opus/WebM) — it must be transcoded
 * to real MP3 before injecting ID3v2.3 tags, otherwise Samsung Music (and Windows)
 * reject the file.
 *
 * Pipeline:
 *  1. Fetch the full audio via /api/youtube-audio (yt-dlp on the server)
 *  2. Decode AAC → PCM with AudioContext.decodeAudioData()
 *  3. Encode PCM → MP3 with lamejs
 *  4. Inject ID3 tags (TIT2, TPE1, TALB, APIC, USLT) with browser-id3-writer
 *  5. Trigger browser download as Artist - Title.mp3
 */

import { resizeCoverArt } from './canvasResize';

// ~2,6 s de audio a 44,1 kHz entre pausas para que la UI respire.
const YIELD_EVERY_CHUNKS = 100;

// ─── MP3 encoding ────────────────────────────────────────────────────────────

/**
 * Transcodes an AAC/M4A ArrayBuffer to a real MP3 ArrayBuffer
 * using Web Audio API (decode) + lamejs (encode).
 * @param {ArrayBuffer} inputBuffer - Raw AAC/M4A bytes
 * @param {function} onProgress - Progress callback 0-100
 * @returns {Promise<ArrayBuffer>} - Raw MP3 bytes
 */
async function transcodeToMp3(inputBuffer, onProgress = () => {}) {
  // Step A: Decode AAC → PCM via AudioContext
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();

  onProgress(10);

  let audioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(inputBuffer.slice(0));
  } finally {
    audioCtx.close();
  }

  onProgress(20);

  // Step B: Extract PCM samples (lamejs needs Int16 arrays)
  const numChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;

  // Convert Float32 PCM [-1, 1] → Int16 [-32768, 32767]
  function floatToInt16(floatArray) {
    const int16 = new Int16Array(floatArray.length);
    for (let i = 0; i < floatArray.length; i++) {
      const s = Math.max(-1, Math.min(1, floatArray[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  }

  const leftPCM = floatToInt16(audioBuffer.getChannelData(0));
  const rightPCM = numChannels > 1
    ? floatToInt16(audioBuffer.getChannelData(1))
    : leftPCM;

  onProgress(35);

  // Step C: Encode PCM → MP3 with lamejs
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const kbps = 320;
  const encoder = new Mp3Encoder(numChannels, sampleRate, kbps);

  const chunkSize = 1152; // lamejs works best with multiples of 1152
  const mp3Chunks = [];
  let offset = 0;
  let lastPct = 35;
  let chunksSinceYield = 0;

  while (offset < numFrames) {
    const end = Math.min(offset + chunkSize, numFrames);
    const leftChunk = leftPCM.subarray(offset, end);
    const rightChunk = rightPCM.subarray(offset, end);

    const encoded = numChannels > 1
      ? encoder.encodeBuffer(leftChunk, rightChunk)
      : encoder.encodeBuffer(leftChunk);

    if (encoded.length > 0) mp3Chunks.push(new Uint8Array(encoded));

    offset += chunkSize;

    // Report progress 35→80 during encoding
    const pct = 35 + Math.floor(((offset / numFrames) * 45));
    if (pct !== lastPct) {
      onProgress(pct);
      lastPct = pct;
    }

    // Ceder el hilo cada cierto tiempo: sin esto la pestaña se congela durante
    // la codificación y la barra de progreso no se repinta hasta el final.
    if (++chunksSinceYield >= YIELD_EVERY_CHUNKS) {
      chunksSinceYield = 0;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Flush remaining data
  const flushed = encoder.flush();
  if (flushed.length > 0) mp3Chunks.push(new Uint8Array(flushed));

  onProgress(80);

  // Combine all chunks into one ArrayBuffer
  const totalLength = mp3Chunks.reduce((acc, c) => acc + c.length, 0);
  const mp3Buffer = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of mp3Chunks) {
    mp3Buffer.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  return mp3Buffer.buffer;
}

// ─── ID3 tagging ─────────────────────────────────────────────────────────────

/**
 * Injects ID3 tags into a real MP3 ArrayBuffer.
 * Tags: TIT2, TPE1, TALB, TCON, TYER, APIC, USLT
 * @param {ArrayBuffer} mp3Buffer - Real MP3 bytes
 * @param {object} tags
 * @param {function} onProgress
 * @returns {Promise<string>} - Object URL for the tagged MP3
 */
async function injectID3Tags(mp3Buffer, tags, onProgress = () => {}) {
  const id3Module = await import('browser-id3-writer');
  const ID3Writer = id3Module.default ?? id3Module.ID3Writer ?? id3Module;

  const writer = new ID3Writer(mp3Buffer);

  writer.setFrame('TIT2', tags.title || 'Unknown Title');
  writer.setFrame('TPE1', [tags.artist || 'Unknown Artist']);
  writer.setFrame('TALB', tags.album || 'Unknown Album');

  if (tags.genre) writer.setFrame('TCON', [tags.genre]);
  if (tags.year)  writer.setFrame('TYER', String(tags.year));

  onProgress(88);

  // APIC: Cover art resized to 600×600 JPEG
  if (tags.coverProxyUrl) {
    try {
      const coverBuffer = await resizeCoverArt(tags.coverProxyUrl);
      writer.setFrame('APIC', {
        type: 3,
        data: coverBuffer,
        description: 'Cover',
        useUnicodeEncoding: true,
      });
    } catch (err) {
      console.warn('Cover art skipped:', err.message);
    }
  }

  // USLT: Unsynchronized lyrics — the tag Samsung Music reads for in-app lyrics
  if (tags.lyrics) {
    writer.setFrame('USLT', {
      description: '',
      lyrics: tags.lyrics,
      language: 'eng',
    });
  }

  writer.addTag();

  onProgress(98);

  const blob = writer.getBlob();
  return URL.createObjectURL(blob);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Full pipeline: YouTube audio → transcode to MP3 → inject ID3 → download.
 * @param {object} tags - Must include tags.artist and tags.title for YouTube search.
 *   If tags.videoId is present (tracks that come from a YouTube playlist), that exact
 *   video is downloaded instead of searching again.
 * @param {function} onProgress - Overall progress 0-100
 */
export async function downloadTaggedMp3(tags, onProgress = () => {}) {
  onProgress(2);

  // 1. Fetch FULL audio from YouTube via server-side proxy
  const params = new URLSearchParams(
    tags.videoId
      ? { videoId: tags.videoId }
      : { artist: tags.artist || '', title: tags.title || '' }
  );
  const audioRes = await fetch(`/api/youtube-audio?${params}`);
  if (!audioRes.ok) {
    const err = await audioRes.json().catch(() => ({}));
    throw new Error(err.error || `YouTube audio failed: ${audioRes.status}`);
  }

  onProgress(8);

  const audioBuffer = await audioRes.arrayBuffer();

  onProgress(12);

  // 2. Transcode to MP3 (progress 12 → 82)
  let mp3Buffer;
  try {
    mp3Buffer = await transcodeToMp3(audioBuffer, (p) => {
      onProgress(12 + Math.floor(p * 0.7));
    });
  } catch (err) {
    console.error('Decode/encode failed:', err);
    throw new Error('El navegador no pudo decodificar el audio descargado. Prueba con Chrome o Samsung Internet.');
  }

  onProgress(83);

  // 3. Inject ID3 tags (progress 83 → 98)
  const objectUrl = await injectID3Tags(mp3Buffer, tags, (p) => {
    onProgress(83 + Math.floor((p / 100) * 15));
  });

  onProgress(99);

  // 4. Trigger download
  const safeTitle  = (tags.title  || 'track') .replace(/[\\/:*?"<>|]/g, '').trim().substring(0, 100);
  const safeArtist = (tags.artist || 'artist').replace(/[\\/:*?"<>|]/g, '').trim().substring(0, 60);
  const filename = `${safeArtist} - ${safeTitle}.mp3`;

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);

  onProgress(100);
}

