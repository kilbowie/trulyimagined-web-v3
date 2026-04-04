import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import Auth0Provider from '@/components/Auth0Provider';
import { ThemeProvider } from '@/components/theme-provider';
import { GlobalRouteTransitionLoader } from '@/components/GlobalRouteTransitionLoader';

export const metadata: Metadata = {
  title: 'Truly Imagined v3 - Global Performer Digital Identity Registry',
  description: 'Identity, Consent, and Control for Performers',
  icons: {
    icon: 'https://assets.trulyimagined.com/logo.png',
    apple: 'https://assets.trulyimagined.com/logo.png',
  },
  openGraph: {
    title: 'Truly Imagined - Global Performer Digital Identity Registry',
    description: 'Identity, Consent, and Control for Performers',
    images: ['https://assets.trulyimagined.com/logo.png'],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Truly Imagined - Global Performer Digital Identity Registry',
    description: 'Identity, Consent, and Control for Performers',
    images: ['https://assets.trulyimagined.com/logo.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
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
