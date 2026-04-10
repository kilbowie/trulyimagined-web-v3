import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VerificationDashboard from './VerificationDashboard';

export default async function AdminVerificationPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  if (!roles.includes('Admin')) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-muted-foreground">Admin role required to view manual verification.</p>
        </div>
      </div>
    );
  }

  return <VerificationDashboard />;
}
