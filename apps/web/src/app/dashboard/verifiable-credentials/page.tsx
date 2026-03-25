import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { VerifiableCredentialsCard } from '@/components/VerifiableCredentials';

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
        <h2 className="text-3xl font-bold tracking-tight">Verifiable Credentials</h2>
        <p className="text-muted-foreground">Manage your W3C-compliant digital credentials</p>
      </div>

      <VerifiableCredentialsCard />
    </div>
  );
}
