import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ConfidenceScoreBadge } from '@/components/ConfidenceScore';
import { VerifiableCredentialsCard } from '@/components/VerifiableCredentials';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  UserCircle,
  Shield,
  Settings,
  FileText,
  ScrollText,
  History,
  ShieldCheck,
  Users,
  Building,
  Wrench,
  Home,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

/**
 * Protected Dashboard Page
 *
 * Modern dashboard with shadcn/ui components
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const hasActorRole = roles.includes('Actor');
  const hasAgentRole = roles.includes('Agent');
  const hasAdminRole = roles.includes('Admin');
  const hasEnterpriseRole = roles.includes('Enterprise');

  const roleConfig: Record<string, { icon: React.ReactNode; color: string; variant: any }> = {
    Actor: {
      icon: <UserCircle className="h-4 w-4" />,
      color: 'text-purple-600',
      variant: 'secondary',
    },
    Agent: {
      icon: <Users className="h-4 w-4" />,
      color: 'text-blue-600',
      variant: 'default',
    },
    Enterprise: {
      icon: <Building className="h-4 w-4" />,
      color: 'text-green-600',
      variant: 'outline',
    },
    Admin: {
      icon: <Wrench className="h-4 w-4" />,
      color: 'text-red-600',
      variant: 'destructive',
    },
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container flex h-16 items-center px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">TrulyImagined</h1>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-6 px-4 space-y-6">
        {/* Welcome Section */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back, {user.name || 'User'}</h2>
          <p className="text-muted-foreground">
            Manage your identity, consents, and credentials from your dashboard
          </p>
        </div>

        {/* User Profile & Roles Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5" />
                Profile
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Name</span>
                <span className="text-sm">{user.name || 'N/A'}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Email</span>
                <span className="text-sm">{user.email}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Verified</span>
                <div className="flex items-center gap-1">
                  {user.email_verified ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-600">Yes</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm text-yellow-600">No</span>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Roles Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Roles & Permissions
              </CardTitle>
              <CardDescription>Your access levels and capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              {roles.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => {
                      const config = roleConfig[role];
                      return (
                        <Badge key={role} variant={config?.variant || 'secondary'}>
                          <span className="mr-1.5">{config?.icon}</span>
                          {role}
                        </Badge>
                      );
                    })}
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Your capabilities:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                      {hasActorRole && <li>• Register identity and manage consent</li>}
                      {hasAgentRole && <li>• Manage actor clients and licensing</li>}
                      {hasEnterpriseRole && <li>• Request licenses and view usage</li>}
                      {hasAdminRole && <li>• Full system administration access</li>}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">No roles found in your session</p>
                  <Card className="border-destructive bg-destructive/5">
                    <CardContent className="pt-6 space-y-3">
                      <p className="text-sm font-medium text-destructive">
                        ⚠️ Roles are missing from your JWT token
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This usually means the Auth0 Action isn't set up correctly.
                      </p>
                      <Button variant="destructive" size="sm" asChild>
                        <Link href="/debug-roles">Debug Roles Issue →</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {roles.length > 0 && (
          <>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight mb-4">Quick Actions</h3>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Actor Actions */}
              {hasActorRole && (
                <>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <Link href="/register-actor">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
                          <UserCircle className="h-5 w-5" />
                          Register Identity
                        </CardTitle>
                        <CardDescription>
                          Add your profile to the Identity Registry
                        </CardDescription>
                      </CardHeader>
                    </Link>
                  </Card>

                  <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <Link href="/dashboard/consent-preferences">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
                          <Settings className="h-5 w-5" />
                          Consent Preferences
                        </CardTitle>
                        <CardDescription>
                          Update your consent policy and usage permissions
                        </CardDescription>
                      </CardHeader>
                    </Link>
                  </Card>

                  <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <Link href="/dashboard/licenses">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
                          <ScrollText className="h-5 w-5" />
                          License Tracker
                        </CardTitle>
                        <CardDescription>
                          Monitor licenses granted to API clients
                        </CardDescription>
                      </CardHeader>
                    </Link>
                  </Card>

                  <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <Link href="/dashboard/consent-history">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
                          <History className="h-5 w-5" />
                          Consent History
                        </CardTitle>
                        <CardDescription>
                          View complete version history of your consent
                        </CardDescription>
                      </CardHeader>
                    </Link>
                  </Card>

                  <Card className="hover:shadow-lg transition-shadow cursor-pointer group">
                    <Link href="/dashboard/verify-identity">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <CardTitle className="flex items-center gap-2 text-lg group-hover:text-primary">
                              <ShieldCheck className="h-5 w-5" />
                              Verify Identity
                            </CardTitle>
                            <CardDescription>
                              Link external providers to increase verification level
                            </CardDescription>
                          </div>
                        </div>
                        {hasActorRole && (
                          <div className="mt-2">
                            <ConfidenceScoreBadge />
                          </div>
                        )}
                      </CardHeader>
                    </Link>
                  </Card>
                </>
              )}

              {/* Agent Actions */}
              {hasAgentRole && (
                <Card className="opacity-60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" />
                      Agent Dashboard
                    </CardTitle>
                    <CardDescription>Coming soon...</CardDescription>
                  </CardHeader>
                </Card>
              )}

              {/* Enterprise Actions */}
              {hasEnterpriseRole && (
                <Card className="opacity-60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Building className="h-5 w-5" />
                      License Requests
                    </CardTitle>
                    <CardDescription>Coming soon...</CardDescription>
                  </CardHeader>
                </Card>
              )}

              {/* Admin Actions */}
              {hasAdminRole && (
                <Card className="opacity-60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wrench className="h-5 w-5" />
                      Admin Panel
                    </CardTitle>
                    <CardDescription>Coming soon...</CardDescription>
                  </CardHeader>
                </Card>
              )}
            </div>
          </>
        )}

        {/* Verifiable Credentials (for users with verified identity) */}
        {hasActorRole && (
          <div>
            <VerifiableCredentialsCard />
          </div>
        )}

        {/* Debug Links (Admin only) */}
        {hasAdminRole && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Developer Tools</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/debug-roles">Debug Roles</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/auth/profile">View Raw Profile</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
