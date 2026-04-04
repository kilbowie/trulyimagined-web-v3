import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowUpRight, BadgeCheck, Users, Inbox } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { query } from '@/lib/db';

export default async function AgentDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/login');
  }

  const roles = await getUserRoles();
  const isAgent = roles.includes('Agent');

  if (!isAgent) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-muted-foreground">Agent role required to access the agency dashboard.</p>
        </div>
      </div>
    );
  }

  const agentResult = await query(
    `SELECT id, agency_name, registry_id, verification_status, profile_completed
     FROM agents
     WHERE auth0_user_id = $1
       AND deleted_at IS NULL`,
    [user.sub]
  );

  const agent = agentResult.rows[0] || null;

  let pendingRequests = 0;
  let rosterCount = 0;

  if (agent) {
    const pendingResult = await query(
      `SELECT COUNT(*) AS count
       FROM representation_requests
       WHERE agent_id = $1
         AND status = 'pending'`,
      [agent.id]
    );
    pendingRequests = parseInt(pendingResult.rows[0].count, 10) || 0;

    const rosterResult = await query(
      `SELECT COUNT(*) AS count
       FROM actor_agent_relationships
       WHERE agent_id = $1
         AND ended_at IS NULL`,
      [agent.id]
    );
    rosterCount = parseInt(rosterResult.rows[0].count, 10) || 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {agent?.agency_name ? `${agent.agency_name}` : 'Agent Dashboard'}
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage representation requests, actor roster, and profile readiness.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Roster Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rosterCount}</div>
            <p className="text-xs text-muted-foreground">Active represented actors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests}</div>
            <p className="text-xs text-muted-foreground">Awaiting your response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Verification Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold capitalize">{agent?.verification_status || 'pending'}</div>
            <p className="text-xs text-muted-foreground">Managed via Admin IAM</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/agent/profile">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Agency Profile</span>
                <ArrowUpRight className="h-5 w-5" />
              </CardTitle>
              <CardDescription>
                Complete your profile to become discoverable and process requests.
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/agent/requests">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>Representation Requests</span>
                <ArrowUpRight className="h-5 w-5" />
              </CardTitle>
              <CardDescription>Review and approve or reject actor requests.</CardDescription>
            </CardHeader>
          </Link>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <Link href="/dashboard/agent/roster">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg">
                <span>My Roster</span>
                <ArrowUpRight className="h-5 w-5" />
              </CardTitle>
              <CardDescription>View represented actors and their consent/licensing data.</CardDescription>
            </CardHeader>
          </Link>
        </Card>
      </div>

      {agent && !agent.profile_completed && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-800">
              <BadgeCheck className="h-5 w-5" />
              Profile completion required
            </CardTitle>
            <CardDescription className="text-amber-700">
              Your profile must be complete before actors can find you by registry ID and before you can
              accept requests.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {!agent && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Create your agency profile
            </CardTitle>
            <CardDescription>
              Start by creating your profile and adding your registered business details.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/agent/profile"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Continue Setup <Inbox className="h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
