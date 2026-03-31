import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { VerifiableCredentialsCard } from '@/components/VerifiableCredentials';
import { Shield } from 'lucide-react';

/**
 * Verifiable Credentials Page
 *
 * Displays and manages user's W3C Verifiable Credentials
 */
export default async function VerifiableCredentialsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const hasActorRole = roles.includes('Actor');

  if (!hasActorRole) {
    redirect('/dashboard');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-8 w-8" />
          Verifiable Credentials
        </h2>
        <p className="text-sm md:text-base text-muted-foreground mt-2">
          Manage your W3C-compliant digital credentials
        </p>
      </div>

      <VerifiableCredentialsCard />
    </div>
  );
}
