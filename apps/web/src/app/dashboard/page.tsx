import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfidenceScoreBadge } from '@/components/ConfidenceScore';
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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back, {user.name || 'User'}!
        </h2>
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
            <Link href="/register-actor">
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
                        <CardDescription>Add your profile to the Identity Registry</CardDescription>
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
                        <CardDescription>Monitor licenses granted to API clients</CardDescription>
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
