import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Inter, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import Auth0Provider from '@/components/Auth0Provider';
import { ThemeProvider } from '@/components/theme-provider';
import { GlobalRouteTransitionLoader } from '@/components/GlobalRouteTransitionLoader';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'Truly Imagined — Identity Infrastructure for the AI Era',
  description: 'The global registry for human digital identity in AI. Register, verify, and license your likeness on your terms.',
  icons: {
    icon: 'https://assets.trulyimagined.com/logo.png',
    apple: 'https://assets.trulyimagined.com/logo.png',
  },
  openGraph: {
    title: 'Truly Imagined — Identity Infrastructure for the AI Era',
    description: 'The global registry for human digital identity in AI.',
    images: ['https://assets.trulyimagined.com/logo.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truly Imagined — Identity Infrastructure for the AI Era',
    description: 'The global registry for human digital identity in AI.',
    images: ['https://assets.trulyimagined.com/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${bricolage.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <Suspense fallback={null}>
            <GlobalRouteTransitionLoader />
          </Suspense>
          <Auth0Provider>{children}</Auth0Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
