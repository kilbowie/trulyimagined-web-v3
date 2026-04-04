'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, UserPlus, Pencil } from 'lucide-react';

type TeamRole = 'Agent' | 'Assistant';
type TeamStatus = 'invited' | 'active' | 'disabled';

type TeamPermissions = {
  canManageRoster: boolean;
  canManageRequests: boolean;
  canViewConsent: boolean;
  canViewLicensing: boolean;
  canManageTeam: boolean;
};

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  member_role: TeamRole;
  access_permissions: TeamPermissions;
  status: TeamStatus;
  invite_sent_at: string | null;
  joined_at: string | null;
  linked_user_profile_id: string | null;
  professional_name: string | null;
  username: string | null;
  is_verified?: boolean | null;
}

const defaultPermissions: TeamPermissions = {
  canManageRoster: true,
  canManageRequests: true,
  canViewConsent: true,
  canViewLicensing: true,
  canManageTeam: false,
};

export default function ManageAgentsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  // Permission editing dialog state
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<TeamPermissions>(defaultPermissions);
  const [savingPerms, setSavingPerms] = useState(false);

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TeamRole>('Assistant');
  const [newMemberPermissions, setNewMemberPermissions] =
    useState<TeamPermissions>(defaultPermissions);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/agent/manage-agents');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load agency team members');
      }

      setMembers(payload.data.members || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return members;

    return members.filter((member) =>
      [member.email, member.full_name || '', member.professional_name || '', member.username || '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [members, search]);

  const resetForm = () => {
    setNewMemberEmail('');
    setNewMemberName('');
    setNewMemberRole('Assistant');
    setNewMemberPermissions(defaultPermissions);
  };

  const createMember = async () => {
    setError(null);
    setSuccess(null);

    if (!newMemberEmail.trim()) {
      setError('Email is required.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/agent/manage-agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newMemberEmail,
          fullName: newMemberName,
          memberRole: newMemberRole,
          accessPermissions: newMemberPermissions,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to add team member');
      }

      setMembers((current) => [payload.data, ...current]);
      setSuccess('Invitation sent. The new member has been added to your agency team.');
      setDialogOpen(false);
      resetForm();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to add team member');
    } finally {
      setSaving(false);
    }
  };

  const updateMember = async (
    memberId: string,
    update: { memberRole?: TeamRole; status?: TeamStatus; accessPermissions?: TeamPermissions }
  ) => {
    setError(null);

    try {
      const response = await fetch(`/api/agent/manage-agents/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update team member');
      }

      setMembers((current) =>
        current.map((member) => (member.id === memberId ? payload.data : member))
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update team member');
    }
  };

  const togglePermission = (key: keyof TeamPermissions) => {
    setNewMemberPermissions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const resendInvite = async (member: TeamMember) => {
    setError(null);
    setSuccess(null);

    try {
      setBusyMemberId(member.id);
      const response = await fetch(`/api/agent/manage-agents/${member.id}`, {
        method: 'POST',
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to resend invitation email');
      }

      setMembers((current) =>
        current.map((entry) => (entry.id === member.id ? payload.data : entry))
      );
      setSuccess(`Invitation resent to ${member.email}.`);
    } catch (resendError) {
      setError(
        resendError instanceof Error ? resendError.message : 'Failed to resend invitation email'
      );
    } finally {
      setBusyMemberId(null);
    }
  };

  const deleteMember = async (member: TeamMember) => {
    const confirmed = window.confirm(`Delete ${member.email} from your agency team?`);
    if (!confirmed) return;

    setError(null);
    setSuccess(null);

    try {
      setBusyMemberId(member.id);
      const response = await fetch(`/api/agent/manage-agents/${member.id}`, {
        method: 'DELETE',
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to delete team member');
      }

      setMembers((current) => current.filter((entry) => entry.id !== member.id));
      setSuccess(`${member.email} has been removed from your agency team.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete team member');
    } finally {
      setBusyMemberId(null);
    }
  };

  const openPermDialog = (member: TeamMember) => {
    setEditingMember(member);
    setEditingPermissions({ ...defaultPermissions, ...member.access_permissions });
    setPermDialogOpen(true);
  };

  const savePermissions = async () => {
    if (!editingMember) return;
    setError(null);
    setSavingPerms(true);
    try {
      await updateMember(editingMember.id, { accessPermissions: editingPermissions });
      setPermDialogOpen(false);
      setEditingMember(null);
    } catch {
      // updateMember already sets error state
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Agents</h1>
          <p className="text-muted-foreground mt-2">
            Add agents and assistants to your agency, assign permissions, and control access.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Team Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>
                Send an email invitation so this person can create a profile and join your agency.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  value={newMemberEmail}
                  onChange={(event) => setNewMemberEmail(event.target.value)}
                  placeholder="name@agency.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name (optional)</label>
                <Input
                  value={newMemberName}
                  onChange={(event) => setNewMemberName(event.target.value)}
                  placeholder="Alex Morgan"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select
                  value={newMemberRole}
                  onValueChange={(value) => setNewMemberRole(value as TeamRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Assistant">Assistant</SelectItem>
                    <SelectItem value="Agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Access Permissions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3">
                  {(
                    [
                      ['canManageRoster', 'Manage Roster'],
                      ['canManageRequests', 'Manage Requests'],
                      ['canViewConsent', 'View Consent'],
                      ['canViewLicensing', 'View Licensing'],
                      ['canManageTeam', 'Manage Team'],
                    ] as Array<[keyof TeamPermissions, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={newMemberPermissions[key]}
                        onChange={() => togglePermission(key)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={createMember} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Send Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Agency Team</CardTitle>
          <CardDescription>
            Team members can be invited and assigned role-based access across agency features.
          </CardDescription>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email or name"
            className="max-w-md"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading team members...
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Last Invite Sent</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No team members found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="space-y-0.5">
                            <p className="font-medium">
                              {member.full_name || member.professional_name || 'Pending User'}
                            </p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.member_role}
                            onValueChange={(value) =>
                              updateMember(member.id, { memberRole: value as TeamRole })
                            }
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Assistant">Assistant</SelectItem>
                              <SelectItem value="Agent">Agent</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={member.status}
                            onValueChange={(value) =>
                              updateMember(member.id, { status: value as TeamStatus })
                            }
                          >
                            <SelectTrigger className="w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="invited">Invited</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="disabled">Disabled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(member.access_permissions || {})
                              .filter(([, enabled]) => Boolean(enabled))
                              .map(([key]) => (
                                <Badge key={key} variant="secondary" className="text-xs">
                                  {key
                                    .replace('can', '')
                                    .replace(/([A-Z])/g, ' $1')
                                    .trim()}
                                </Badge>
                              ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {member.invite_sent_at
                            ? new Date(member.invite_sent_at).toLocaleString('en-GB')
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {member.linked_user_profile_id ? (
                            <Badge variant={member.is_verified ? 'default' : 'secondary'}>
                              {member.is_verified ? 'Verified' : 'Unverified'}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">Pending Signup</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {member.joined_at
                            ? new Date(member.joined_at).toLocaleDateString('en-GB')
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openPermDialog(member)}
                              title="Edit permissions"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Permissions
                            </Button>
                            {(member.status === 'invited' || member.status === 'disabled') && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyMemberId === member.id}
                                onClick={() => resendInvite(member)}
                              >
                                Resend Email
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busyMemberId === member.id}
                              onClick={() => deleteMember(member)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Permissions Dialog */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              {editingMember
                ? `Adjust access permissions for ${editingMember.full_name || editingMember.email}.`
                : 'Adjust access permissions.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-2 rounded-md border p-3 py-4">
            {(
              [
                ['canManageRoster', 'Manage Roster'],
                ['canManageRequests', 'Manage Requests'],
                ['canViewConsent', 'View Consent'],
                ['canViewLicensing', 'View Licensing'],
                ['canManageTeam', 'Manage Team'],
              ] as Array<[keyof TeamPermissions, string]>
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-3 text-sm cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded"
                  checked={editingPermissions[key]}
                  onChange={() =>
                    setEditingPermissions((current) => ({ ...current, [key]: !current[key] }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPermDialogOpen(false)}
              disabled={savingPerms}
            >
              Cancel
            </Button>
            <Button onClick={savePermissions} disabled={savingPerms}>
              {savingPerms ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
