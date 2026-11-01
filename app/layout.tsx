import type { Metadata, Viewport } from 'next';
import './globals.css'; // Global styles

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export const metadata: Metadata = {
  title: 'P2P Encrypted Chat & Calling',
  description: 'Zero-knowledge peer-to-peer end-to-end encrypted messaging and video calling with client-side cryptographic identity and local storage.',
  openGraph: {
    title: 'P2P Encrypted Chat & Calling',
    description: 'Zero-knowledge peer-to-peer end-to-end encrypted messaging and video calling with client-side cryptographic identity and local storage.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'P2P Encrypted Chat & Calling',
    description: 'Zero-knowledge peer-to-peer end-to-end encrypted messaging and video calling with client-side cryptographic identity and local storage.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="h-full w-full overflow-hidden">
      <body suppressHydrationWarning className="h-full w-full overflow-hidden bg-zinc-950 text-zinc-100 antialiased select-none touch-manipulation">
        {children}
      </body>
    </html>
  );
}
