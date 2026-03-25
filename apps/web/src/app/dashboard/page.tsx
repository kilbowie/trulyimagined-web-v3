import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfidenceScoreBadge } from '@/components/ConfidenceScore';
import { query } from '@/lib/db';
import { queries } from '@database/queries-v3';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  ShieldCheck,
  Activity,
  ArrowUpRight,
} from 'lucide-react';

/**
 * Dashboard Home Page
 *
 * Overview and quick stats
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const hasActorRole = roles.includes('Actor');

  // Fetch actor data to get stage name
  let displayName = user.name || 'User';
  if (hasActorRole) {
    try {
      const actorResult = await query(queries.actors.getByAuth0Id, [user.sub]);
      if (actorResult.rows && actorResult.rows.length > 0) {
        const actor = actorResult.rows[0];
        // Use stage_name if available, otherwise fall back to first_name
        if (actor.stage_name && actor.stage_name.trim()) {
          displayName = actor.stage_name;
        } else if (actor.first_name && actor.first_name.trim()) {
          displayName = actor.first_name;
        }
      }
    } catch (error) {
      console.error('Failed to fetch actor data:', error);
      // Keep default displayName on error
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Welcome back, {displayName}!</h2>
        <p className="text-muted-foreground">
          Here's an overview of your identity and consent management
        </p>
      </div>

      {/* Stats Grid */}
      {hasActorRole && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Identity Status</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Active</div>
              <p className="text-xs text-muted-foreground">
                <ConfidenceScoreBadge />
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credentials</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">W3C Verifiable Credentials</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">Manage in Consent Preferences</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">License Grants</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
              <p className="text-xs text-muted-foreground">View in License Tracker</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions Grid */}
      {hasActorRole && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/dashboard/profile">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg group-hover:text-primary">
                  <span>View Profile</span>
                  <ArrowUpRight className="h-5 w-5" />
                </CardTitle>
                <CardDescription>Your account information and roles</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/dashboard/verifiable-credentials">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg group-hover:text-primary">
                  <span>Credentials</span>
                  <ArrowUpRight className="h-5 w-5" />
                </CardTitle>
                <CardDescription>Manage your W3C verifiable credentials</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/dashboard/consent-preferences">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg group-hover:text-primary">
                  <span>Consent Settings</span>
                  <ArrowUpRight className="h-5 w-5" />
                </CardTitle>
                <CardDescription>Configure your consent preferences</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/dashboard/verify-identity">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg group-hover:text-primary">
                  <span>Verify Identity</span>
                  <ArrowUpRight className="h-5 w-5" />
                </CardTitle>
                <CardDescription>Link providers to increase verification</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/dashboard/register-identity">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg group-hover:text-primary">
                  <span>Register Identity</span>
                  <ArrowUpRight className="h-5 w-5" />
                </CardTitle>
                <CardDescription>Add your profile to the registry</CardDescription>
              </CardHeader>
            </Link>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
            <Link href="/dashboard/consent-history">
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-lg group-hover:text-primary">
                  <span>Consent History</span>
                  <ArrowUpRight className="h-5 w-5" />
                </CardTitle>
                <CardDescription>View your consent ledger history</CardDescription>
              </CardHeader>
            </Link>
          </Card>
        </div>
      )}

      {/* Getting Started Section */}
      {hasActorRole && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Quick guide to using your identity dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Register Your Identity</p>
                <p className="text-sm text-muted-foreground">
                  Add your profile to the Identity Registry
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Verify Your Identity</p>
                <p className="text-sm text-muted-foreground">
                  Link external providers to increase your verification level
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Set Consent Preferences</p>
                <p className="text-sm text-muted-foreground">
                  Configure how your identity can be used
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Issue Credentials</p>
                <p className="text-sm text-muted-foreground">
                  Create W3C verifiable credentials to share with third parties
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
