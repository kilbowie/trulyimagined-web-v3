import type { Metadata } from 'next';
import './globals.css';
import Auth0Provider from '@/components/Auth0Provider';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Truly Imagined v3 - Global Performer Digital Identity Registry',
  description: 'Identity, Consent, and Control for Performers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Auth0Provider>{children}</Auth0Provider>
        </ThemeProvider>
      </body>
    </html>
  );
}
