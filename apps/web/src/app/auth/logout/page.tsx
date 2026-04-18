'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Mock logout page — clears the dev session cookie and redirects home.
 */
export default function MockLogoutPage() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/mock-auth/logout', { method: 'POST' }).finally(() => {
      router.push('/');
      router.refresh();
    });
  }, [router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Signing out…</p>
    </div>
  );
}
