import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import {
  UserCircle,
  Shield,
  Users,
  Building,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Mail,
  ShieldCheck,
} from 'lucide-react';

/**
 * User Profile Page
 *
 * Displays user information and roles
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();

  const roleConfig: Record<
    string,
    { icon: React.ReactNode; color: string; variant: 'secondary' | 'default' | 'outline' | 'destructive' }
  > = {
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
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Profile</h2>
        <p className="text-muted-foreground">Manage your account information and roles</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>Your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <UserCircle className="h-4 w-4" />
                <span className="font-medium">Name</span>
              </div>
              <p className="text-lg">{user.name || 'N/A'}</p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="font-medium">Email</span>
              </div>
              <p className="text-lg">{user.email}</p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span className="font-medium">Email Verification</span>
              </div>
              <div className="flex items-center gap-2">
                {user.email_verified ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="text-lg text-green-600 font-medium">Verified</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="text-lg text-yellow-600 font-medium">Not Verified</span>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roles Card */}
        <Card>
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
                      <Badge key={role} variant={config?.variant || 'secondary'} className="text-sm py-1 px-3">
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
                    {roles.includes('Actor') && <li>• Register identity and manage consent</li>}
                    {roles.includes('Agent') && <li>• Manage actor clients and licensing</li>}
                    {roles.includes('Enterprise') && <li>• Request licenses and view usage</li>}
                    {roles.includes('Admin') && <li>• Full system administration access</li>}
                  </ul>
                </div>
              </div>
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Debug Section for Admins */}
      {roles.includes('Admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Developer Tools</CardTitle>
            <CardDescription>Additional debugging and testing tools</CardDescription>
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
  );
}
