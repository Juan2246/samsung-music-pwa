'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

export default function SearchBar({ onSearch, isLoading, placeholder }) {

  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const handleChange = useCallback(
    (e) => {
      const value = e.target.value;
      setQuery(value);
      clearTimeout(debounceRef.current);
      if (value.trim().length >= 2) {
        debounceRef.current = setTimeout(() => {
          onSearch(value.trim());
        }, 600);
      }
    },
    [onSearch]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    clearTimeout(debounceRef.current);
    if (query.trim()) onSearch(query.trim());
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
    onSearch('');
  };

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`relative flex items-center rounded-2xl transition-all duration-300 ${
          focused
            ? 'ring-2 ring-accent ring-opacity-60 shadow-glow'
            : 'ring-1 ring-border'
        } bg-surfaceElevated`}
      >
        {/* Search icon */}
        <div className="pl-4 pr-2 flex items-center pointer-events-none">
          {isLoading ? (
            <svg
              className="w-5 h-5 text-accent animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className={`w-5 h-5 transition-colors duration-200 ${
                focused ? 'text-accent' : 'text-textMuted'
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          id="search-input"
          value={query}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder || 'Buscar canción o artista...'}
          aria-label={placeholder || 'Buscar canción o artista'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          className="flex-1 bg-transparent py-4 pr-2 text-textPrimary placeholder-textMuted text-base focus:outline-none"
        />

        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="p-2 mr-2 rounded-xl text-textMuted hover:text-textPrimary hover:bg-surfaceHigh transition-all duration-200"
            aria-label="Limpiar búsqueda"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* Submit button */}
        <button
          type="submit"
          id="search-submit"
          className="m-1.5 px-4 py-2.5 bg-accentDark hover:bg-[#1450e6] text-white rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95 shrink-0"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
