import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardSidebar } from '@/components/DashboardSidebar';
import { DashboardQuickSearch } from '@/components/DashboardQuickSearch';

/**
 * Dashboard Layout with Sidebar
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <DashboardSidebar userName={user.name || user.email} roles={roles} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-16 border-b bg-background px-4 md:px-6">
          <div className="mx-auto flex h-full max-w-7xl items-center justify-center">
            <DashboardQuickSearch roles={roles} />
          </div>
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container py-6 px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
