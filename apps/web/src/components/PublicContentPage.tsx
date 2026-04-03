import type { ReactNode } from 'react';
import Link from 'next/link';
import AuthNav from '@/components/AuthNav';
import SiteFooter from '@/components/SiteFooter';

interface PublicContentPageProps {
  title: string;
  summary: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function PublicContentPage({
  title,
  summary,
  lastUpdated,
  children,
}: PublicContentPageProps) {
  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-slate-800 bg-slate-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.svg"
              alt="Truly Imagined Logo"
              className="h-8 w-auto transition-transform duration-200 hover:scale-[1.08]"
            />
          </Link>
          <AuthNav />
        </div>
      </header>

      <main className="min-h-screen bg-background px-6 pb-16 pt-28">
        <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-8 md:p-10">
          <p className="text-sm font-medium text-muted-foreground">Last updated: {lastUpdated}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-4 text-base text-muted-foreground md:text-lg">{summary}</p>

          <article className="prose prose-slate mt-8 max-w-none dark:prose-invert">
            {children}
          </article>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
