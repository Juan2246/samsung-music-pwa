'use client';
import { useState } from 'react';

export default function MetadataPanel({ song, lyrics, isLoadingLyrics, onMetadataChange }) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [fields, setFields] = useState({
    title: song?.title || '',
    artist: song?.artist || '',
    album: song?.album || '',
    year: song?.releaseYear?.toString() || '',
    genre: song?.genre || '',
  });

  const handleChange = (key, value) => {
    const updated = { ...fields, [key]: value };
    setFields(updated);
    onMetadataChange?.(updated);
  };

  if (!song) return null;

  const tags = [
    { key: 'TIT2', label: 'Título', field: 'title', icon: '🎵' },
    { key: 'TPE1', label: 'Artista', field: 'artist', icon: '🎤' },
    { key: 'TALB', label: 'Álbum', field: 'album', icon: '💿' },
    { key: 'TYER', label: 'Año', field: 'year', icon: '📅' },
    { key: 'TCON', label: 'Género', field: 'genre', icon: '🎼' },
  ];

  return (
    <div className="card-elevated p-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-accent/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-accent" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-textPrimary">Metadatos ID3</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-pressed={editMode}
            onClick={() => setEditMode(!editMode)}
            className={`text-xs px-3 py-1.5 rounded-xl transition-all duration-200 ${
              editMode
                ? 'bg-accentDark text-white'
                : 'bg-surfaceHigh text-textSecondary hover:text-textPrimary'
            }`}
          >
            {editMode ? 'Listo ✓' : 'Editar'}
          </button>
        </div>
      </div>

      {/* Album art + basic info */}
      <div className="flex gap-3 mb-4">
        <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-surfaceHigh relative">
          {song.coverThumb ? (
            <img
              src={song.coverThumb}
              alt={`Portada de ${song.album || song.title}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg className="w-8 h-8 text-textMuted" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          )}
          {/* APIC badge */}
          <div className="absolute bottom-1 left-1 right-1 bg-black/70 rounded-lg text-center">
            <span className="text-[9px] text-accent font-bold">APIC 600×600</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs text-textMuted mb-1">Tags inyectados:</p>
          <div className="flex flex-wrap gap-1">
            {['TIT2', 'TPE1', 'TALB', 'APIC', 'USLT'].map((tag) => (
              <span
                key={tag}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                  tag === 'USLT'
                    ? 'bg-accent/20 text-accentLight border border-accent/30'
                    : 'bg-surfaceHigh text-textSecondary'
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tag fields */}
      <div className="space-y-2.5">
        {tags.map(({ key, label, field, icon }) => (
          <div key={key} className="relative">
            <div className="flex items-center gap-2 bg-surface rounded-xl p-3 border border-border">
              <span className="text-sm shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-textMuted">{key}</span>
                  <span className="text-[10px] text-textMuted">·</span>
                  <span className="text-[10px] text-textMuted">{label}</span>
                </div>
                {editMode ? (
                  <input
                    type="text"
                    value={fields[field]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    aria-label={`${label} (${key})`}
                    className="w-full bg-transparent text-sm text-textPrimary mt-0.5 rounded"
                    placeholder={`Ingresa ${label.toLowerCase()}...`}
                  />
                ) : (
                  <p className="text-sm text-textPrimary mt-0.5 truncate">
                    {fields[field] || <span className="text-textMuted italic">No disponible</span>}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Lyrics section */}
      <div className="mt-4">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 bg-surface rounded-xl border border-border hover:border-accent/30 transition-all duration-200"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm">🎼</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-accent">USLT</span>
                <span className="text-[10px] text-textMuted">· Lyrics</span>
              </div>
              <span className="text-xs text-textSecondary">
                {isLoadingLyrics
                  ? 'Buscando letra...'
                  : lyrics
                  ? `${lyrics.split('\n').length} líneas`
                  : 'Letra no encontrada'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoadingLyrics && (
              <svg className="w-4 h-4 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {lyrics && !isLoadingLyrics && (
              <span className="text-[10px] text-success bg-success/10 px-2 py-0.5 rounded-full">✓</span>
            )}
            <svg
              className={`w-4 h-4 text-textMuted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {expanded && lyrics && (
          <div className="mt-2 p-3 bg-surface rounded-xl border border-border max-h-48 overflow-y-auto animate-fade-in">
            <pre className="text-xs text-textSecondary whitespace-pre-wrap font-sans leading-relaxed">
              {lyrics}
            </pre>
          </div>
        )}
        {expanded && !lyrics && !isLoadingLyrics && (
          <div className="mt-2 p-3 bg-surface rounded-xl border border-border text-center animate-fade-in">
            <p className="text-xs text-textMuted">
              No se encontró la letra. La canción se descargará sin USLT.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
