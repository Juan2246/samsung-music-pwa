'use client';
import { useState, useEffect } from 'react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up safe-area-bottom">
      <div className="glass-high rounded-3xl p-4 flex items-center gap-3">
        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shrink-0">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-textPrimary">Instalar App</p>
          <p className="text-xs text-textSecondary truncate">
            Instala MusicDL como app nativa en tu Samsung
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl text-textMuted hover:text-textPrimary hover:bg-surfaceHigh transition-all duration-200"
            aria-label="Cerrar"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            onClick={handleInstall}
            id="pwa-install-btn"
            type="button"
            className="px-4 py-2 bg-accentDark hover:bg-[#1450e6] text-white text-sm font-semibold rounded-xl transition-all duration-200 active:scale-95"
          >
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
}
