import { getCurrentUser, getUserRoles, getAgentTeamMembership } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { NoPermission } from '@/components/NoPermission';
import RequestsContent from './RequestsContent';

export default async function RequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [roles, membership] = await Promise.all([getUserRoles(), getAgentTeamMembership()]);
  const hasAgentRole = roles.includes('Agent');

  if (!hasAgentRole && !membership?.permissions.canManageRequests) {
    return (
      <NoPermission
        feature="Representation Requests"
        agencyName={membership?.agencyName}
      />
    );
  }

  return <RequestsContent />;
}
