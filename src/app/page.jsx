'use client';
import { useState, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import SearchBar from '@/components/SearchBar';
import SongCard from '@/components/SongCard';
import MetadataPanel from '@/components/MetadataPanel';
import DownloadButton from '@/components/DownloadButton';
import InstallPrompt from '@/components/InstallPrompt';
import AlbumView from '@/components/AlbumView';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('song'); // 'song' | 'album'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [albumData, setAlbumData] = useState(null); // { album, tracks }
  const [lyrics, setLyrics] = useState(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const detailRef = useRef(null);
  // Contadores para descartar respuestas viejas: si el usuario busca o elige otra
  // canción antes de que llegue la respuesta anterior, esa respuesta se ignora.
  const searchSeq = useRef(0);
  const lyricsSeq = useRef(0);

  const handleSearch = useCallback(async (q) => {
    const seq = ++searchSeq.current;
    if (!q) {
      setQuery('');
      setResults([]);
      setSearchError(null);
      return;
    }
    setQuery(q);
    setIsSearching(true);
    setSearchError(null);
    setAlbumData(null);
    setSelectedSong(null);

    try {
      const isAlbumUrl = q.includes('spotify.com/album') || q.includes('spotify.com/playlist') || (q.includes('youtube.com') && q.includes('list=')) || (q.includes('music.youtube.com') && q.includes('list='));

      if (activeTab === 'album' || isAlbumUrl) {
        if (isAlbumUrl && activeTab !== 'album') setActiveTab('album');
        const res = await fetch(`/api/album-parser?url=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (seq !== searchSeq.current) return;
        if (data.error) throw new Error(data.error);
        setAlbumData({ album: data.album, tracks: data.tracks });
        setResults([]);
      } else {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=25`);
        const data = await res.json();
        if (seq !== searchSeq.current) return;
        if (data.error) throw new Error(data.error);
        setResults(data.results || []);
        setAlbumData(null);
      }
    } catch (err) {
      if (seq !== searchSeq.current) return;
      setSearchError(err.message || 'Error al buscar. Intenta de nuevo.');
      setResults([]);
      setAlbumData(null);
    } finally {
      if (seq === searchSeq.current) setIsSearching(false);
    }
  }, [activeTab]);

  const handleCSVUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setActiveTab('csv');
    setQuery('');
    setResults([]);
    setAlbumData(null);
    setSearchError(null);
    setIsSearching(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().replace(/^\uFEFF/, ''), // Strip BOM + whitespace
      complete: (results) => {
        try {
          const columnNames = results.data.length > 0 ? Object.keys(results.data[0]) : [];

          const parsedTracks = results.data.map((row, index) => {
            // ── Confirmed exact Spanish Exportify column names ──
            const uri =
              row['URI de la canción'] ||
              row['Track URI'] || row['Spotify URI'] || row['URI de la pista'] || '';

            const title =
              row['Nombre de la canción'] ||
              row['Track Name'] ||
              row['Nombre de la pista'] ||
              row['Nombre'] || row['Name'] || row['Title'] || row['Título'] || '';

            const artist =
              row['Nombre(s) del artista'] ||
              row['Artist Name(s)'] || row['Artist Name'] ||
              row['Artistas'] || row['Artista(s)'] || row['Artista'] ||
              row['Artist Names'] ||
              row['Nombre(s) del artista del álbum'] || '';

            const album =
              row['Nombre del álbum'] ||
              row['Album Name'] ||
              row['Nombre del Álbum'] || row['Nombre del album'] ||
              row['Album'] || row['Álbum'] || '';

            const coverUrl =
              row['URL de la imagen del álbum'] ||
              row['Album Image URL'] ||
              row['URL de la Im'] || row['Cover'] || null;

            const releaseDate =
              row['Fecha de lanzamiento del álbum'] ||
              row['Album Release Date'] ||
              row['Fecha de lan'] || row['Fecha'] || '';

            const year = releaseDate ? releaseDate.substring(0, 4) : '';

            if (!title) return null;

            return {
              id: uri ? uri.replace('spotify:track:', '') : `csv-${index}`,
              title: title.trim(),
              artist: artist.trim(),
              album: album.trim(),
              coverUrl: coverUrl || null,
              year: year || null,
              isCsvEnriched: true
            };
          }).filter(Boolean);

          if (parsedTracks.length === 0) {
            const cols = columnNames.length > 0
              ? columnNames.slice(0, 8).join(' | ')
              : 'sin columnas';
            throw new Error(`Columnas no reconocidas en el CSV. Encontradas: ${cols}`);
          }

          setAlbumData({
            album: {
              title: file.name.replace('.csv', ''),
              artist: 'CSV Exportify',
              coverUrl: null,
              totalTracks: parsedTracks.length,
              isPristineCsv: true, // flag for AlbumView to know it's strict metadata
            },
            tracks: parsedTracks
          });
        } catch (err) {
          setSearchError(err.message);
        } finally {
          setIsSearching(false);
          e.target.value = ''; // Reset input
        }
      },
      error: (err) => {
        setSearchError('Error leyendo el archivo CSV: ' + err.message);
        setIsSearching(false);
        e.target.value = '';
      }
    });
  }, []);

  const handleSelectSong = useCallback(async (song) => {
    const seq = ++lyricsSeq.current;
    setSelectedSong(song);
    setLyrics(null);
    setIsLoadingLyrics(true);
    setMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album,
      year: song.releaseYear?.toString() || '',
      genre: song.genre || '',
    });

    // Scroll to detail panel
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    // Fetch lyrics in parallel
    try {
      const res = await fetch(
        `/api/lyrics?artist=${encodeURIComponent(song.artist)}&title=${encodeURIComponent(song.title)}`
      );
      const data = await res.json();
      // Sin este control, la letra de la canción anterior podía llegar tarde y
      // terminar incrustada (USLT) en el MP3 de la canción elegida después.
      if (seq !== lyricsSeq.current) return;
      setLyrics(data.lyrics || null);
    } catch {
      if (seq === lyricsSeq.current) setLyrics(null);
    } finally {
      if (seq === lyricsSeq.current) setIsLoadingLyrics(false);
    }
  }, []);

  const switchTab = (tab) => {
    searchSeq.current++; // descarta una búsqueda en curso de la otra pestaña
    setActiveTab(tab);
    setQuery('');
    setResults([]);
    setAlbumData(null);
    setSelectedSong(null);
    setSearchError(null);
    setIsSearching(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-40 px-4 pt-10 pb-4">
        <div className="max-w-2xl mx-auto">
          {/* Logo row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-accent to-accentDark flex items-center justify-center shadow-glow shrink-0">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text leading-tight">
                Samsung Music DL
              </h1>
              <p className="text-xs text-textMuted">Descarga con ID3 completo</p>
            </div>

            {/* ID3 badges */}
            <div className="ml-auto flex gap-1 flex-wrap justify-end">
              {['TIT2', 'APIC', 'USLT'].map((t) => (
                <span
                  key={t}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-accent/15 text-accent border border-accent/20"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex p-1 bg-surfaceHigh rounded-2xl mb-4 border border-border">
            <button
              type="button"
              aria-pressed={activeTab === 'song'}
              onClick={() => switchTab('song')}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activeTab === 'song'
                  ? 'bg-accentDark text-white shadow-glow'
                  : 'text-textMuted hover:text-textPrimary'
              }`}
            >
              <span aria-hidden="true">🎵</span> Canciones
            </button>
            <button
              type="button"
              aria-pressed={activeTab === 'album'}
              onClick={() => switchTab('album')}
              className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-300 ${
                activeTab === 'album'
                  ? 'bg-accentDark text-white shadow-glow'
                  : 'text-textMuted hover:text-textPrimary'
              }`}
            >
              <span aria-hidden="true">💿</span> Álbumes
            </button>
            <label
              className={`flex-1 flex items-center justify-center py-2 text-sm font-semibold rounded-xl transition-all duration-300 cursor-pointer focus-within:ring-2 focus-within:ring-accentLight ${
                activeTab === 'csv'
                  ? 'bg-accentDark text-white shadow-glow'
                  : 'text-textMuted hover:text-textPrimary'
              }`}
            >
              <span aria-hidden="true">📄</span>&nbsp;Subir CSV
              {/* sr-only (no hidden) para que el campo siga siendo alcanzable con teclado */}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={handleCSVUpload} />
            </label>
          </div>

          {/* Search bar */}
          {activeTab !== 'csv' && (
            <SearchBar
              key={activeTab} // al cambiar de pestaña el campo vuelve a quedar vacío
              onSearch={handleSearch}
              isLoading={isSearching} 
              placeholder={activeTab === 'song' ? 'Buscar canción o artista...' : 'Pega URL de Álbum (Spotify/YouTube)...'}
            />
          )}
          {activeTab === 'csv' && !albumData && !isSearching && (
            <div className="p-4 bg-surfaceHigh/50 border border-border border-dashed rounded-xl text-center">
               <p className="text-sm text-textPrimary">Selecciona el archivo CSV de Exportify para cargar tu biblioteca con metadata perfecta.</p>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-4 py-4 max-w-2xl mx-auto w-full">
        {/* Empty state / Hero */}
        {!query && results.length === 0 && !selectedSong && !albumData && (
          <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-surfaceElevated to-surfaceHigh flex items-center justify-center mb-6 relative">
              <div className="absolute inset-0 rounded-3xl bg-accent/10 animate-pulse-glow" />
              <svg className="w-12 h-12 text-accent" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-textPrimary mb-2">
              Tu biblioteca, perfecta
            </h2>
            <p className="text-sm text-textSecondary text-center max-w-xs leading-relaxed">
              Busca cualquier canción y descárgala con{' '}
              <span className="text-accentLight font-medium">metadatos ID3 completos</span>{' '}
              listos para Samsung Music
            </p>

            {/* Feature chips */}
            <div className="flex flex-wrap gap-2 mt-6 justify-center">
              {[
                { icon: '🎨', text: 'Carátula 600×600' },
                { icon: '📝', text: 'Letras USLT' },
                { icon: '🎵', text: 'Tags ID3v2.3' },
                { icon: '📱', text: 'Samsung Music' },
              ].map((f) => (
                <div
                  key={f.text}
                  className="flex items-center gap-1.5 bg-surfaceElevated border border-border rounded-2xl px-3 py-2"
                >
                  <span className="text-sm">{f.icon}</span>
                  <span className="text-xs text-textSecondary">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search error */}
        {searchError && (
          <div role="alert" className="p-4 bg-error/10 border border-error/30 rounded-2xl mb-4 animate-fade-in">
            <p className="text-sm text-error text-center">{searchError}</p>
          </div>
        )}

        {/* No results */}
        {query && !isSearching && !searchError && !albumData && results.length === 0 && activeTab === 'song' && (
          <div className="py-12 text-center animate-fade-in">
            <p className="text-sm text-textPrimary font-medium">Sin resultados para «{query}»</p>
            <p className="text-xs text-textSecondary mt-1">Prueba con otro título o con el nombre del artista.</p>
          </div>
        )}

        {/* Album View */}
        {albumData && (
          <AlbumView
            key={`${albumData.album.title}-${albumData.tracks.length}`}
            album={albumData.album}
            tracks={albumData.tracks}
          />
        )}

        {/* Results list */}
        {results.length > 0 && !albumData && (
          <div className="mb-4 animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-textMuted">
                {results.length} resultados
              </p>
              {selectedSong && (
                <span className="text-xs text-accentLight">
                  ↓ Ver detalles abajo
                </span>
              )}
            </div>
            <div className="space-y-2">
              {results.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  isSelected={selectedSong?.id === song.id}
                  onClick={handleSelectSong}
                />
              ))}
            </div>
          </div>
        )}

        {/* Detail panel */}
        {selectedSong && (
          <div ref={detailRef} className="space-y-4 pb-32 animate-slide-up">
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-textMuted px-2">Detalle de descarga</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <MetadataPanel
              key={selectedSong.id} // al cambiar de canción el panel arranca limpio
              song={selectedSong}
              lyrics={lyrics}
              isLoadingLyrics={isLoadingLyrics}
              onMetadataChange={setMetadata}
            />

            {/* Download section */}
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-success/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-textPrimary">Descarga</h3>
              </div>
              <DownloadButton
                song={selectedSong}
                metadata={metadata}
                lyrics={lyrics}
              />
            </div>

            {/* Samsung Music compatibility note */}
            <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl">
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">📱</span>
                <div>
                  <p className="text-xs font-semibold text-textPrimary mb-1">
                    Compatibilidad con Samsung Music
                  </p>
                  <p className="text-xs text-textSecondary leading-relaxed">
                    El archivo incluye el tag{' '}
                    <span className="font-mono text-accentLight">USLT</span> que Samsung
                    Music usa para mostrar letras, y{' '}
                    <span className="font-mono text-accentLight">APIC</span> con la
                    carátula en 600×600px JPEG.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Install prompt */}
      <InstallPrompt />
    </div>
  );
}
