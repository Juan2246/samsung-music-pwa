import { Inter } from 'next/font/google';
import './globals.css';

// next/font descarga Inter en el build y la sirve desde la propia app:
// no hace falta además el <link> a Google Fonts.
const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Samsung Music Downloader',
  description: 'Descarga música con metadatos ID3 completos compatibles con Samsung Music',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'MusicDL',
  },
};

// En Next 16 themeColor y viewport van en su propio export.
// Sin maximumScale/userScalable: bloquear el zoom impide ampliar el texto a quien lo necesita.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} bg-background text-textPrimary antialiased`}>
        {children}
      </body>
    </html>
  );
}
