import { getCurrentUser, getUserRoles, getAgentTeamMembership } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { NoPermission } from '@/components/NoPermission';
import RosterContent from './RosterContent';

export default async function RosterPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/auth/login');

  const [roles, membership] = await Promise.all([getUserRoles(), getAgentTeamMembership()]);
  const hasAgentRole = roles.includes('Agent');

  if (!hasAgentRole && !membership?.permissions.canManageRoster) {
    return <NoPermission feature="My Roster" agencyName={membership?.agencyName} />;
  }

  return <RosterContent />;
}
