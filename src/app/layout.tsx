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
    'self-learning bot',
    'content reactor',
    'multi-platform marketing',
  ],
  metadataBase: new URL('https://grothi.com'),
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
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

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Grothi',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://grothi.com',
  description: 'AI-powered marketing bot platform. Create self-learning bots that automate your social media marketing across multiple platforms.',
  offers: {
    '@type': 'Offer',
    price: '10.00',
    priceCurrency: 'USD',
    description: 'Starting from $10 for 1,000 credits',
  },
  creator: {
    '@type': 'Organization',
    name: 'Grothi',
    url: 'https://grothi.com',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
        />
      )}
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');`,
          }}
        />
      )}
    </html>
  );
}
