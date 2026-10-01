'use client';
import { useState } from 'react';
import { downloadTaggedMp3 } from '@/lib/id3Tagger';

export default function DownloadButton({ song, metadata, lyrics }) {
  const [state, setState] = useState('idle'); // idle | loading | done | error
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const handleDownload = async () => {
    if (!song) return;
    setState('loading');
    setProgress(0);
    setErrorMsg('');

    try {
      const coverProxyUrl = song.coverUrl
        ? `/api/cover-proxy?url=${encodeURIComponent(song.coverUrl)}`
        : null;

      await downloadTaggedMp3(
        {
          title:  metadata?.title  || song.title,
          artist: metadata?.artist || song.artist,
          album:  metadata?.album  || song.album,
          genre:  metadata?.genre  || song.genre,
          year:   metadata?.year ? parseInt(metadata.year) : song.releaseYear,
          coverProxyUrl,
          lyrics: lyrics || null,
        },
        (p) => setProgress(p)
      );

      setState('done');
      setTimeout(() => setState('idle'), 4000);
    } catch (err) {
      console.error('Download failed:', err);
      setErrorMsg(err.message || 'Error desconocido');
      setState('error');
      setTimeout(() => setState('idle'), 6000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      {state === 'loading' && (
        <div className="space-y-2 animate-fade-in">
          <div className="flex justify-between text-xs text-textMuted">
            <span>
              {progress < 10
                ? '🔍 Buscando en YouTube...'
                : progress < 12
                ? '⬇️ Descargando audio completo...'
                : progress < 83
                ? `🔄 Convirtiendo a MP3 (320kbps)... ${progress}%`
                : progress < 98
                ? '🏷️ Inyectando ID3 tags...'
                : '✅ Preparando archivo...'}
            </span>
            <span className="font-mono text-accent">{progress}%</span>
          </div>
          <div className="w-full h-2.5 bg-surfaceHigh rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-accentLight rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error message */}
      {state === 'error' && (
        <div className="p-3 bg-error/10 border border-error/30 rounded-xl animate-fade-in">
          <p className="text-xs text-error font-medium mb-1">Error al descargar</p>
          <p className="text-xs text-error/80">{errorMsg}</p>
        </div>
      )}

      {/* Main download button */}
      <button
        id="download-btn"
        onClick={handleDownload}
        disabled={!song || state === 'loading'}
        className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden
          ${
            state === 'done'
              ? 'bg-success text-white'
              : state === 'loading'
              ? 'bg-accent/50 text-white cursor-not-allowed'
              : !song
              ? 'bg-surfaceElevated text-textMuted cursor-not-allowed border border-border'
              : 'bg-accent hover:bg-accentLight text-white cursor-pointer'
          }
        `}
        style={
          state === 'idle' && song
            ? { boxShadow: '0 4px 20px rgba(61, 126, 255, 0.4)' }
            : {}
        }
      >
        {/* Waveform animation during loading */}
        {state === 'loading' && (
          <div className="flex items-center gap-0.5 h-5">
            {[0, 0.15, 0.3, 0.15, 0].map((delay, i) => (
              <div
                key={i}
                className="w-1 bg-white rounded-full"
                style={{
                  height: '100%',
                  animation: `waveform 0.8s ease-in-out infinite ${delay}s`,
                }}
              />
            ))}
          </div>
        )}

        {state === 'done' && (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
        )}

        {state === 'idle' && song && (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" />
          </svg>
        )}

        {state === 'error' && (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        )}

        <span>
          {state === 'loading'
            ? 'Procesando...'
            : state === 'done'
            ? '¡Descarga completada!'
            : state === 'error'
            ? 'Reintentar descarga'
            : !song
            ? 'Selecciona una canción'
            : 'Descargar MP3 completo'}
        </span>
      </button>

      {/* Info note */}
      {song && state === 'idle' && (
        <p className="text-center text-xs text-textMuted">
          🎵 Audio completo vía YouTube · Tags ID3 · Compatible con Samsung Music
        </p>
      )}
    </div>
  );
}
