import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
