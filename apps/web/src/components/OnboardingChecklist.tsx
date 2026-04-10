'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Loader2, ArrowRight } from 'lucide-react';

type OnboardingStep = {
  id: 'signup' | 'profile' | 'verify-identity' | 'consent' | 'complete';
  label: string;
  completed: boolean;
  href: string;
};

type OnboardingResponse = {
  success: boolean;
  data: {
    actorId: string | null;
    registryId: string | null;
    verificationStatus: string;
    profileCompleted: boolean;
    canProfileGoLive: boolean;
    currentStep: OnboardingStep['id'];
    steps: OnboardingStep[];
    progress: {
      completed: number;
      total: number;
    };
  };
};

export function OnboardingChecklist() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingResponse['data'] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/onboarding/status');
        const payload = (await response.json()) as OnboardingResponse | { error?: string };

        if (!response.ok || !('success' in payload) || !payload.success) {
          throw new Error(
            'error' in payload
              ? payload.error || 'Failed to load onboarding status'
              : 'Failed to load onboarding status'
          );
        }

        setData(payload.data);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load onboarding status'
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const completionText = useMemo(() => {
    if (!data) return '0 / 4 complete';
    return `${data.progress.completed} / ${data.progress.total} complete`;
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Onboarding Checklist</CardTitle>
        <CardDescription>Track your progress to becoming fully active.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading onboarding status...
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : data ? (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{completionText}</Badge>
              {data.registryId ? (
                <span className="text-xs text-muted-foreground">
                  Registry ID: {data.registryId}
                </span>
              ) : null}
            </div>

            <div className="space-y-3">
              {data.steps.map((step, index) => (
                <div
                  key={step.id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    {step.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">
                        Step {index + 1}: {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.completed ? 'Completed' : 'Pending'}
                      </p>
                    </div>
                  </div>
                  {!step.completed ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={step.href}>Open</Link>
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            {data.currentStep !== 'complete' ? (
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">Next recommended action</p>
                  <p className="text-sm text-muted-foreground">Continue onboarding flow</p>
                </div>
                <Button asChild>
                  <Link href={`/dashboard/onboarding?step=${data.currentStep}`}>
                    Continue <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border p-3 bg-green-50 text-green-800 text-sm">
                All onboarding steps are complete. Your profile is live.
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
