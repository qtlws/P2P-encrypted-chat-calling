import type {Metadata} from 'next';
import './globals.css'; // Global styles

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
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
