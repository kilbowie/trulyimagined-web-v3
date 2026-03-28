import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import FeedbackDashboard from './FeedbackDashboard';

/**
 * Admin Feedback Dashboard Page
 * Shows all user feedback with filtering and stats
 */
export default async function AdminFeedbackPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const isAdmin = roles.includes('Admin');

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-muted-foreground">Admin role required to view user feedback.</p>
        </div>
      </div>
    );
  }

  return <FeedbackDashboard />;
}
