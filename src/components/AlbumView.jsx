'use client';
import { useState, useCallback, useRef } from 'react';
import pLimit from 'p-limit';
import { downloadTaggedMp3 } from '@/lib/id3Tagger';

// Max 2 concurrent downloads to avoid saturating Samsung browser CPU
const limit = pLimit(2);

export default function AlbumView({ album, tracks }) {
  const [selectedIds, setSelectedIds] = useState(new Set(tracks.map(t => t.id)));
  const [downloadStates, setDownloadStates] = useState({}); 
  // Map of id -> { state: 'idle'|'loading'|'done'|'error', progress: 0, errorMsg: '', message: '' }
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const toggleSelection = (id) => {
    const newKeys = new Set(selectedIds);
    if (newKeys.has(id)) newKeys.delete(id);
    else newKeys.add(id);
    setSelectedIds(newKeys);
  };

  const toggleAll = () => {
    if (selectedIds.size === tracks.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(tracks.map(t => t.id)));
  };

  const updateTrackState = (id, updates) => {
    setDownloadStates(prev => ({
      ...prev,
      [id]: { ...prev[id], ...updates }
    }));
  };

  const downloadTrack = async (track) => {
    updateTrackState(track.id, { state: 'loading', progress: 0, errorMsg: '', message: '🔍 Buscando...' });
    
    try {
      // 1. Fetch lyrics synchronously before tagging
      let lyrics = null;
      try {
        const res = await fetch(`/api/lyrics?artist=${encodeURIComponent(track.artist)}&title=${encodeURIComponent(track.title)}`);
        if (res.ok) {
          const data = await res.json();
          lyrics = data.lyrics;
        }
      } catch (e) {
        console.warn('Lyrics failed for', track.title);
      }

      // 2. Fetch extended metadata from iTunes if it's a CSV pristine track
      let coverUrl = track.coverUrl;
      let genre = '';
      let year = null;

      if (track.isCsvEnriched) {
        updateTrackState(track.id, { message: '🎨 Buscando Metadatos BD...' });
        try {
          const enrichRes = await fetch(`/api/enrich-metadata?title=${encodeURIComponent(track.title)}&artist=${encodeURIComponent(track.artist)}`);
          if (enrichRes.ok) {
            const enrichData = await enrichRes.json();
            if (enrichData.coverUrl) coverUrl = enrichData.coverUrl;
            if (enrichData.genre) genre = enrichData.genre;
            if (enrichData.year) year = enrichData.year;
          }
        } catch (e) {
          console.warn('Metadata enrichment failed for', track.title);
        }
      }

      // 3. Start tagging/download pipeline
      const coverProxyUrl = coverUrl ? `/api/cover-proxy?url=${encodeURIComponent(coverUrl)}` : null;

      await downloadTaggedMp3(
        {
          videoId: track.videoId, // pistas de YouTube: se baja ese video exacto, sin volver a buscar
          title: track.title,
          artist: track.artist,
          album: track.album,
          genre: genre,
          year: year,
          coverProxyUrl,
          lyrics,
        },
        (p) => {
          let msg = '⬇️ Descargando audio...';
          if (p >= 12 && p < 83) msg = `🔄 320kbps MP3... ${p}%`;
          if (p >= 83 && p < 98) msg = '🏷️ Inyectando ID3...';
          if (p >= 98) msg = '✅ Preparando...';
          updateTrackState(track.id, { progress: p, message: msg });
        }
      );
      updateTrackState(track.id, { state: 'done', progress: 100, message: '¡Completado!' });
    } catch (err) {
      updateTrackState(track.id, { state: 'error', errorMsg: err.message, message: 'Error' });
    }
  };

  const handleDownloadSelected = async () => {
    setIsDownloadingAll(true);

    const tracksToDownload = tracks.filter(t => selectedIds.has(t.id));
    
    // Create an array of promise-returning functions wrapped in pLimit
    const promises = tracksToDownload.map(t => limit(() => downloadTrack(t)));
    
    await Promise.allSettled(promises);
    
    setIsDownloadingAll(false);
  };

  const selectedCount = selectedIds.size;
  const isAllSelected = selectedCount === tracks.length;

  return (
    <div className="animate-slide-up space-y-4 pb-32">
      {/* Album Header */}
      <div className="card-elevated p-4 flex gap-4 bg-surfaceHigh">
        <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 shadow-lg relative">
          {album.coverUrl ? (
            <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-surface flex items-center justify-center">💿</div>
          )}
          {/* Badge */}
          <div className="absolute bottom-1 left-1 right-1 bg-black/70 rounded-lg text-center backdrop-blur-md">
            <span className="text-[10px] text-accent font-bold">BATCH</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
          <p className="text-[10px] font-mono text-accent mb-1 uppercase tracking-wider">Álbum Detectado</p>
          <h2 className="text-lg font-bold text-textPrimary truncate leading-tight">{album.title}</h2>
          <p className="text-sm text-textSecondary truncate">{album.artist}</p>
          <p className="text-xs text-textMuted mt-1">{album.totalTracks} canciones</p>
        </div>
      </div>

      {album.isTruncated && (
        <div className="card p-4 bg-warning/10 border-warning/20 flex gap-3 items-start animate-fade-in">
          <span className="text-xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-warning">Lista Incompleta (Máx 100)</h3>
            <p className="text-xs text-textSecondary mt-1 leading-relaxed">
              Spotify limita la extracción anónima a 100 canciones. Para poder descargar las {album.totalTracks} canciones de esta lista, configura tu propia API Key gratis siguiendo las instrucciones dentro de tu archivo <code className="bg-surface/50 border border-border px-1.5 py-0.5 rounded text-warning">.env.local</code>.
            </p>
          </div>
        </div>
      )}

      {/* Batch Controls */}
      <div className="card p-4 shadow-2xl border border-border">
        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={isAllSelected} 
              onChange={toggleAll}
              className="w-5 h-5 rounded-md border-border text-accent focus:ring-accent accent-accent bg-surfaceHigh"
            />
            <span className="text-sm font-medium text-textPrimary group-hover:text-accent transition-colors">
              Seleccionar Todos
            </span>
          </label>
          <span className="text-xs text-textMuted font-mono">
            {selectedCount} / {tracks.length}
          </span>
        </div>

        <button
          onClick={handleDownloadSelected}
          disabled={selectedCount === 0 || isDownloadingAll}
          className={`w-full py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-3 transition-all duration-300 relative overflow-hidden
            ${
              isDownloadingAll
                ? 'bg-accent/50 text-white cursor-not-allowed'
                : selectedCount === 0
                ? 'bg-surfaceElevated text-textMuted cursor-not-allowed'
                : 'bg-accent hover:bg-accentLight text-white shadow-glow'
            }
          `}
        >
          {isDownloadingAll ? (
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Descargando Lote... (Max 2)</span>
            </div>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Descargar Selección Alta Calidad</span>
            </>
          )}
        </button>
      </div>

      {/* Tracklist */}
      <div className="space-y-2">
        {tracks.map((track, i) => {
          const ds = downloadStates[track.id] || { state: 'idle' };
          const isSelected = selectedIds.has(track.id);
          
          return (
            <div 
              key={track.id} 
              className={`p-3 rounded-2xl border transition-all duration-200
                ${isSelected ? 'bg-surface border-accent/30' : 'bg-surface/50 border-border opacity-75'}
                ${ds.state === 'loading' ? 'shadow-glow' : ''}
              `}
            >
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  checked={isSelected}
                  onChange={() => toggleSelection(track.id)}
                  disabled={isDownloadingAll}
                  className="w-4 h-4 rounded mt-1 shrink-0 accent-accent"
                />
                <span className="text-xs text-textMuted font-mono w-4 shrink-0 text-right">{i+1}.</span>
                <div className="flex-1 min-w-0 ml-1">
                  <p className={`text-sm font-medium truncate ${isSelected ? 'text-textPrimary' : 'text-textSecondary'}`}>
                    {track.title}
                  </p>
                  <p className="text-[10px] text-textMuted truncate">{track.artist}</p>
                </div>
                
                {ds.state === 'done' && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-success/20 flex items-center justify-center text-success">
                    ✓
                  </div>
                )}
                {ds.state === 'error' && (
                  <button onClick={() => downloadTrack(track)} className="shrink-0 text-xs text-error hover:underline">
                    Reintentar
                  </button>
                )}
              </div>

              {/* Error message (antes no se mostraba: solo había bloque para loading/done) */}
              {ds.state === 'error' && ds.errorMsg && (
                <p className="mt-2 ml-7 pl-4 text-[11px] text-error">{ds.errorMsg}</p>
              )}

              {/* Individual Progress Bar */}
              {(ds.state === 'loading' || ds.state === 'done') && (
                <div className="mt-3 ml-7 pl-4 border-l-2 border-surfaceHigh animate-fade-in">
                  <div className="flex justify-between text-[10px] text-textMuted mb-1.5">
                    <span>{ds.message}</span>
                    <span className="font-mono">{ds.progress || 0}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-surfaceHigh rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out flex items-center justify-end pr-1
                        ${ds.state === 'done' ? 'bg-success' : 'bg-gradient-to-r from-accent to-accentLight'}
                      `}
                      style={{ width: `${Math.max(5, ds.progress || 0)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
