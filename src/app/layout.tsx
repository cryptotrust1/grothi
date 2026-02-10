import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Grothi - AI Marketing Bot Platform',
    template: '%s | Grothi',
  },
  description:
    'Create your own AI-powered marketing bot. Automate social media with white-hat, self-learning bots that work 24/7 across multiple platforms.',
  keywords: [
    'AI marketing bot',
    'social media automation',
    'white hat marketing',
    'AI content generator',
    'marketing automation platform',
  ],
  metadataBase: new URL('https://grothi.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://grothi.com',
    siteName: 'Grothi',
    title: 'Grothi - AI Marketing Bot Platform',
    description:
      'Create your own AI-powered marketing bot. Automate social media with white-hat, self-learning bots.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grothi - AI Marketing Bot Platform',
    description:
      'Create your own AI-powered marketing bot. Automate social media with white-hat, self-learning bots.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
