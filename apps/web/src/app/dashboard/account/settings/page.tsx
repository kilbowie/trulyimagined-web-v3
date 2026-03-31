import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Shield, CreditCard, Bell, UserCircle, Lock, CheckCircle2 } from 'lucide-react';

/**
 * Account Settings Page
 *
 * Mobile-first, theme-responsive account settings shell.
 * Billing is intentionally placeholder-only for now.
 */
export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Account Settings
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
          Manage your account profile, notifications, security posture, and billing preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <UserCircle className="h-5 w-5" />
              Profile Snapshot
            </CardTitle>
            <CardDescription>Core account information for this signed-in profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Display Name
                </p>
                <p className="mt-1 text-sm text-foreground">{user.name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Email Address
                </p>
                <p className="mt-1 break-all text-sm text-foreground">{user.email || 'Not available'}</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Assigned Roles
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {roles.length > 0 ? (
                  roles.map((role) => (
                    <Badge key={role} variant="secondary" className="text-xs">
                      {role}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="text-xs">
                    No roles assigned
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button asChild className="w-full sm:w-auto">
                <Link href="/dashboard/profile">Edit Profile</Link>
              </Button>
              <Button asChild variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <CheckCircle2 className="h-5 w-5" />
              Account Health
            </CardTitle>
            <CardDescription>Quick status checks for your account setup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">Authentication</span>
              <span className="font-medium text-foreground">Active</span>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">Role Mapping</span>
              <span className="font-medium text-foreground">
                {roles.length > 0 ? 'Configured' : 'Pending'}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <span className="text-muted-foreground">Profile Completion</span>
              <span className="font-medium text-foreground">In App</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Notification controls are being finalized.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
              Email notification preferences will be available here.
            </div>
            <Button variant="outline" disabled className="w-full">
              Notification Settings (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Shield className="h-5 w-5" />
              Privacy & Consent
            </CardTitle>
            <CardDescription>Manage permissions and data-sharing controls.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Review and update your consent settings and historical decisions.
            </p>
            <div className="flex flex-col gap-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/consent-preferences">Open Consent Preferences</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/consent-history">View Consent History</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Lock className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Additional security settings are planned.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
              Password, session, and MFA controls will be managed from this panel.
            </div>
            <Button variant="outline" disabled className="w-full">
              Security Controls (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <CreditCard className="h-5 w-5" />
            Billing
            <Badge variant="secondary" className="ml-1 text-xs">
              Placeholder
            </Badge>
          </CardTitle>
          <CardDescription>
            Billing is not ready to implement yet. This section is intentionally a placeholder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Subscription plans, invoices, and payment methods will be added here in a future release.
          </p>
          <Button disabled className="w-full sm:w-auto">
            Manage Billing (Coming Soon)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
