import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import BillingPageClient from './BillingPageClient';

export default async function AccountBillingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Billing & Payments
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          Your one-stop hub for subscription billing, payment operations, finance history, and
          payout readiness.
        </p>
      </div>

      <Suspense fallback={null}>
        <BillingPageClient />
      </Suspense>
    </div>
  );
}
