import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';

import './globals.css';

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'VeritasWeb',
  description:
    'Forensic web capture and legal evidence platform',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media:
          '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media:
          '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],

    apple: '/apple-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
    >
      <body
        className={`
          ${geistSans.variable}
          ${geistMono.variable}
          min-h-screen
          bg-zinc-950
          text-white
          antialiased
        `}
      >
        {children}

        {process.env.NODE_ENV ===
          'production' && <Analytics />}
      </body>
    </html>
  );
}