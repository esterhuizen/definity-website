import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { TrackPageView } from '@/components/TrackPageView';
import { SITE } from '@/config/pool';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const display = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: SITE.title,
    template: '%s — Definity',
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
    images: ['/logo.png'],
  },
  twitter: {
    card: 'summary',
    title: SITE.title,
    description: SITE.description,
    images: ['/logo.png'],
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
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
