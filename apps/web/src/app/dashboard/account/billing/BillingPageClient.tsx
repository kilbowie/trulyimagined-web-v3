'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  ReceiptText,
} from 'lucide-react';

type BillingPlan = {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  featureHighlights: string[];
  configured: boolean;
};

type BillingSummary = {
  success: boolean;
  stripeConfigured: boolean;
  customer: { id: string; email: string | null; name: string | null } | null;
  subscription: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    items: Array<{ id: string; priceId: string; productName: string }>;
  } | null;
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    currency: string;
    created: number;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
  availablePlans: BillingPlan[];
  error?: string;
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatDateFromUnix(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function BillingPageClient() {
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  const checkoutStatus = searchParams.get('checkout');

  const checkoutMessage = useMemo(() => {
    if (checkoutStatus === 'success') {
      return {
        type: 'success' as const,
        text: 'Checkout completed. Stripe will finalize your subscription shortly.',
      };
    }

    if (checkoutStatus === 'cancelled') {
      return {
        type: 'warning' as const,
        text: 'Checkout was cancelled. You can start again any time.',
      };
    }

    return null;
  }, [checkoutStatus]);

  useEffect(() => {
    let mounted = true;

    async function loadSummary() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/billing/summary', { cache: 'no-store' });
        const payload = (await response.json()) as BillingSummary;

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || 'Failed to load billing summary');
        }

        if (mounted) {
          setSummary(payload);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load billing data');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSummary();

    return () => {
      mounted = false;
    };
  }, []);

  async function startCheckout(planId: string) {
    try {
      setCheckoutPlanId(planId);
      setError(null);

      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(payload.error || 'Failed to start checkout');
      }

      window.location.href = payload.url;
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'Failed to start checkout');
      setCheckoutPlanId(null);
    }
  }

  async function openBillingPortal() {
    try {
      setOpeningPortal(true);
      setError(null);

      const response = await fetch('/api/billing/portal', {
        method: 'POST',
      });

      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.url) {
        throw new Error(payload.error || 'Failed to open billing portal');
      }

      window.location.href = payload.url;
    } catch (portalError) {
      setError(
        portalError instanceof Error ? portalError.message : 'Failed to open billing portal'
      );
      setOpeningPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-10">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading billing information...
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {checkoutMessage && (
        <Card
          className={
            checkoutMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-amber-500/30 bg-amber-500/10'
          }
        >
          <CardContent className="flex items-start gap-2 py-4 text-sm">
            {checkoutMessage.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            <p className="text-foreground">{checkoutMessage.text}</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="flex items-start gap-2 py-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {!summary?.stripeConfigured && (
        <Card className="border-amber-500/30 bg-amber-500/10">
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Stripe Billing Not Configured</CardTitle>
            <CardDescription>
              Configure Stripe keys and plan price IDs to enable live subscription billing.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <CreditCard className="h-5 w-5" />
              Subscription Plans
            </CardTitle>
            <CardDescription>
              Plans are aligned to Truly Imagined profile types and trust workflows.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary?.availablePlans?.length ? (
              summary.availablePlans.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground md:text-base">
                        {plan.name}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {plan.priceLabel}
                        </Badge>
                        {!plan.configured && (
                          <Badge variant="outline" className="text-xs">
                            Not configured
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => startCheckout(plan.id)}
                      disabled={
                        !summary?.stripeConfigured || !plan.configured || checkoutPlanId === plan.id
                      }
                      className="w-full sm:w-auto"
                    >
                      {checkoutPlanId === plan.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting...
                        </>
                      ) : (
                        'Choose Plan'
                      )}
                    </Button>
                  </div>

                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground md:text-sm">
                    {plan.featureHighlights.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No billing plans are available for your current role.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Current Subscription</CardTitle>
            <CardDescription>
              Manage your active plan, payment methods, and invoices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {summary?.subscription ? (
              <>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <p className="font-medium text-foreground">
                    Status: {summary.subscription.status}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Renewal:{' '}
                    {summary.subscription.currentPeriodEnd
                      ? formatDateFromUnix(summary.subscription.currentPeriodEnd)
                      : 'Unavailable'}
                  </p>
                  {summary.subscription.cancelAtPeriodEnd && (
                    <p className="mt-1 text-amber-700 dark:text-amber-300">
                      Canceling at period end
                    </p>
                  )}
                </div>
                <Button onClick={openBillingPortal} disabled={openingPortal} className="w-full">
                  {openingPortal ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening Portal...
                    </>
                  ) : (
                    'Manage in Stripe Portal'
                  )}
                </Button>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                No active subscription found yet.
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ReceiptText className="h-4 w-4" />
                Recent Invoices
              </div>
              {summary?.invoices?.length ? (
                <div className="space-y-2">
                  {summary.invoices.slice(0, 3).map((invoice) => (
                    <div
                      key={invoice.id}
                      className="rounded-lg border border-border p-2.5 text-xs md:text-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {invoice.number || invoice.id}
                        </span>
                        <span className="text-muted-foreground">
                          {formatCurrency(invoice.amountPaid, invoice.currency)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-muted-foreground">
                        <span>{formatDateFromUnix(invoice.created)}</span>
                        {invoice.hostedInvoiceUrl && (
                          <a
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No invoices available.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <p>
              Need account-level controls? Manage profile and security settings in Account Settings.
            </p>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/dashboard/account/settings">Go to Account Settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
