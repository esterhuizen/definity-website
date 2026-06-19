import type { Metadata, Viewport } from 'next';
import { Inter, Bodoni_Moda, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import './dfy.css';
import { TrackPageView } from '@/components/TrackPageView';
import { SITE } from '@/config/pool';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

// Redesign display face — high-contrast Didone serif for the manifesto headlines.
const display = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '700', '900'],
  style: ['normal', 'italic'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#1430cf',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: '%s - Definity',
  },
  description: SITE.description,
  applicationName: 'Definity',
  icons: {
    icon: '/favicon.ico',
    apple: '/logo.png',
  },
  keywords: [
    'Solana',
    'stake pool',
    'liquid staking',
    'definSOL',
    'LST',
    'DeFi',
    'Solana APAC',
    'Solana Middle East',
    'Solana Africa',
    'Solana South America',
    'staking rewards',
  ],
  openGraph: {
    title: SITE.title,
    description: SITE.description,
    url: SITE.url,
    siteName: 'Definity',
    type: 'website',
    // og:image is provided by the file-based opengraph-image.tsx (per route).
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE.title,
    description: SITE.description,
    // twitter:image falls back to og:image (the Concept-D card).
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen flex flex-col">
        <TrackPageView />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
