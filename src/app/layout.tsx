import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Grothi: AI Marketing Bot | 10X Growth, 10X Less Time',
    template: '%s | Grothi',
  },
  description:
    'Self-learning AI bot posts to 17 platforms 24/7. Replace $3k agencies, save 20hrs/week, grow 10X faster. Try free, no credit card.',
  keywords: [
    'AI marketing bot',
    'social media automation',
    'AI content generation',
    'replace social media agency',
    'automated marketing bot',
    'multi-platform social media tool',
    'AI social media manager',
    'social media automation tool',
    'AI marketing automation',
    'AI content generator for social media',
    'social media scheduling tool',
    'automated social media posting',
    'AI social media bot',
    'multi-platform social media scheduler',
    'social media management software',
    'AI social media marketing',
    'social media bot for business',
    'Hootsuite alternative',
    'Buffer alternative',
    'self-learning marketing bot',
    'AI image generator for social media',
    'AI video generator for marketing',
    'social media automation for small business',
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
    title: 'Grothi: AI Marketing Bot That Works 24/7 | 10X Growth',
    description:
      'Self-learning AI bot posts to 17 platforms 24/7. Replace $3k agencies, save 20hrs/week, grow 10X faster. Try free, no credit card.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grothi: AI Marketing Bot That Works 24/7 | 10X Growth',
    description:
      'Self-learning AI bot posts to 17 platforms 24/7. Replace $3k agencies, save 20hrs/week, grow 10X faster. Try free, no credit card.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Grothi',
  url: 'https://grothi.com',
  logo: 'https://grothi.com/favicon.svg',
  description: 'AI marketing bot platform that posts to 17 social media platforms and learns what works.',
  sameAs: [],
};

const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Grothi',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Social Media Management',
  operatingSystem: 'Web',
  url: 'https://grothi.com',
  description: 'Self-learning AI marketing bot. Generate content, post to 17 platforms, and grow 10X faster with algorithm-trained AI automation.',
  featureList: 'AI content generation, AI image generation, AI video generation, multi-platform posting, self-learning optimization, smart scheduling, ban detection, analytics dashboard',
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '29.00',
    highPrice: '199.00',
    priceCurrency: 'USD',
    offerCount: 3,
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.9',
    reviewCount: '2500',
    bestRating: '5',
  },
  creator: {
    '@type': 'Organization',
    name: 'Grothi',
    url: 'https://grothi.com',
  },
};

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is this just another scheduling tool?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No! Grothi is a self-learning AI bot. It doesn\'t just schedule \u2014 it creates content, optimizes timing, engages with your audience, and learns from results. Think of it as a marketing team, not a tool.',
      },
    },
    {
      '@type': 'Question',
      name: 'Will the content sound robotic?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nope. Our AI is trained on millions of successful posts. It learns your brand voice and writes naturally. Most people can\'t tell it\'s AI.',
      },
    },
    {
      '@type': 'Question',
      name: 'How is this different from ChatGPT?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ChatGPT is general-purpose. Grothi is specifically trained on social media algorithms. It knows what gets engagement on each platform, optimal posting times, and how to format content for maximum reach.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I get banned for using this?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Grothi is 100% white-hat and complies with all platform terms of service. We use official APIs, never fake engagement or spam.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need a credit card for the free trial?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nope! Start with 100 free credits, no credit card required. Only add payment when you\'re ready to upgrade.',
      },
    },
  ],
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
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
      </head>
      <body className={inter.className}>
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
