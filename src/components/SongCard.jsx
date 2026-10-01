'use client';

function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SongCard({ song, isSelected, onClick }) {
  const thumb = song.coverThumb;

  return (
    <button
      onClick={() => onClick(song)}
      id={`song-card-${song.id}`}
      className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 group relative overflow-hidden
        ${
          isSelected
            ? 'bg-accent/15 border border-accent/40 shadow-glow'
            : 'bg-surface hover:bg-surfaceElevated border border-transparent hover:border-border'
        }
      `}
    >
      {/* Album art */}
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 relative bg-surfaceHigh">
        {thumb ? (
          <img
            src={thumb}
            alt={`${song.album} cover`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-6 h-6 text-textMuted" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
        {/* Selected overlay */}
        {isSelected && (
          <div className="absolute inset-0 bg-accent/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        )}
      </div>

      {/* Song info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold truncate ${
            isSelected ? 'text-accentLight' : 'text-textPrimary group-hover:text-white'
          }`}
        >
          {song.title}
        </p>
        <p className="text-xs text-textSecondary truncate mt-0.5">{song.artist}</p>
        <p className="text-xs text-textMuted truncate mt-0.5">{song.album}</p>
      </div>

      {/* Duration + genre */}
      <div className="text-right shrink-0 flex flex-col items-end gap-1">
        {song.duration && (
          <span className="text-xs text-textMuted font-mono">
            {formatDuration(song.duration)}
          </span>
        )}
        {song.genre && (
          <span className="text-[10px] bg-surfaceHigh text-textMuted px-2 py-0.5 rounded-full">
            {song.genre}
          </span>
        )}
      </div>
    </button>
  );
}
