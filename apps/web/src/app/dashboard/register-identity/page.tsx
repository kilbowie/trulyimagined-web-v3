import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { AlertCircle, Shield } from 'lucide-react';
import { RegistrationForm } from '@/components/RegistrationForm';
import { RegistrationStatus } from '@/components/RegistrationStatus';
import { query } from '@/lib/db';

/**
 * Fetch actor registration status directly from database
 */
async function getActorStatus(auth0UserId: string) {
  try {
    const result = await query(
      `SELECT 
        id,
        registry_id,
        first_name,
        last_name,
        stage_name,
        location,
        bio,
        verification_status,
        is_founding_member,
        created_at,
        updated_at,
        email
      FROM actors 
      WHERE auth0_user_id = $1`,
      [auth0UserId]
    );

    if (result.rows.length === 0) {
      return { registered: false, actor: null };
    }

    const actor = result.rows[0];
    return {
      registered: true,
      actor: {
        id: actor.id,
        registryId: actor.registry_id,
        firstName: actor.first_name,
        lastName: actor.last_name,
        stageName: actor.stage_name,
        location: actor.location,
        bio: actor.bio,
        verificationStatus: actor.verification_status,
        isFoundingMember: actor.is_founding_member,
        createdAt: actor.created_at,
        updatedAt: actor.updated_at,
        email: actor.email,
      },
    };
  } catch (error) {
    console.error('[IDENTITY] Status fetch error:', error);
    return { registered: false, actor: null };
  }
}

/**
 * Identity Registration Portal
 *
 * One-time registration and management for actors
 * Similar to Spotlight profile management
 */
export default async function IdentityRegistrationPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const hasActorRole = roles.includes('Actor');

  // Fetch actor registration status from database
  const statusData = await getActorStatus(user.sub);

  if (!hasActorRole) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Identity Registration</h2>
          <p className="text-muted-foreground">Register your professional identity</p>
        </div>

        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="space-y-2">
                <p className="font-medium">Actor Role Required</p>
                <p className="text-sm text-muted-foreground">
                  You need the Actor role to register your identity. Please contact support if you
                  should have access.
                </p>
                <Button variant="outline" size="sm" asChild className="mt-4">
                  <Link href="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Note: In a real implementation, we'd fetch the actor's registration status from the API
  // For now, we'll show the registration form
  // TODO: Add API call to check if user is already registered

  // Show registration status if already registered
  if (statusData.registered && statusData.actor) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Identity Registration</h2>
          <p className="text-muted-foreground">Your registered professional identity</p>
        </div>

        <RegistrationStatus actor={statusData.actor} />
      </div>
    );
  }

  // Show registration form if not registered
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Identity Registration</h2>
        <p className="text-muted-foreground">
          Register your professional identity in the TrulyImagined Registry
        </p>
      </div>

      {/* Registration Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            About Your Registry Profile
          </CardTitle>
          <CardDescription>Your unique identity in the TrulyImagined platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium">What is a Registry ID?</h4>
            <p className="text-sm text-muted-foreground">
              Similar to a Spotlight PIN, your Registry ID is a unique identifier that represents
              your verified professional identity across the TrulyImagined platform. Once
              registered, you can use this ID to manage consent, track usage, and control how your
              identity is used.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <h4 className="text-sm font-medium">Registration Benefits</h4>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li>• Unique, permanent Registry ID</li>
              <li>• Professional identity verification</li>
              <li>• Consent management and tracking</li>
              <li>• W3C verifiable credentials</li>
              <li>• Usage monitoring and licensing control</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Registration Form Component */}
      <RegistrationForm userEmail={user.email} userName={user.name} />
    </div>
  );
}
