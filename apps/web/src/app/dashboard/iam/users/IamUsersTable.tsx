'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Check, CheckCircle2, Loader2, ShieldCheck, Star } from 'lucide-react';

interface IamUser {
  id: string;
  auth0_user_id: string;
  email: string;
  role: string;
  username: string;
  legal_name: string;
  professional_name: string;
  profile_completed: boolean;
  is_verified: boolean;
  is_pro: boolean;
  created_at: string;
  updated_at: string;
  actor_id: string | null;
  first_name: string | null;
  last_name: string | null;
  stage_name: string | null;
  verification_status: string | null;
  registry_id: string | null;
  agent_id: string | null;
  agency_name: string | null;
  agent_verification_status: string | null;
  agent_registry_id: string | null;
  agent_profile_completed: boolean | null;
}

interface SuccessToast {
  id: number;
  message: string;
}

export default function IamUsersTable() {
  const [users, setUsers] = useState<IamUser[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<Record<string, boolean>>({});
  const [successToasts, setSuccessToasts] = useState<SuccessToast[]>([]);

  const pushSuccessToast = (message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setSuccessToasts((current) => [...current, { id, message }]);

    setTimeout(() => {
      setSuccessToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/iam/users');
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load users');
      }

      setUsers(payload.data.users || []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return users;
    }

    return users.filter((user) => {
      return [
        user.email,
        user.username,
        user.legal_name,
        user.professional_name,
        user.stage_name || '',
        user.agency_name || '',
        user.role,
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [users, search]);

  const updateStatus = async (userId: string, field: 'is_verified' | 'is_pro', value: boolean) => {
    const saveKey = `${userId}:${field}`;
    const targetUser = users.find((user) => user.id === userId);
    const displayName =
      targetUser?.professional_name || targetUser?.legal_name || targetUser?.email || 'User';
    const fieldLabel = field === 'is_verified' ? 'Verified' : 'Pro';

    setSavingState((current) => ({ ...current, [saveKey]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/iam/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isVerified: field === 'is_verified' ? value : undefined,
          isPro: field === 'is_pro' ? value : undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update user status');
      }

      setUsers((current) =>
        current.map((user) => {
          if (user.id !== userId) {
            return user;
          }

          return {
            ...user,
            is_verified: field === 'is_verified' ? value : user.is_verified,
            is_pro: field === 'is_pro' ? value : user.is_pro,
            updated_at: payload.data.updated_at,
          };
        })
      );

      pushSuccessToast(`${fieldLabel} ${value ? 'enabled' : 'disabled'} for ${displayName}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update user status');
    } finally {
      setSavingState((current) => {
        const next = { ...current };
        delete next[saveKey];
        return next;
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {successToasts.length > 0 && (
        <div className="fixed top-20 right-6 z-50 space-y-2 pointer-events-none">
          {successToasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 shadow-md"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                <span>{toast.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h2 className="text-3xl font-bold tracking-tight">IAM Users</h2>
        <p className="text-muted-foreground">
          Manage account-level verification and Pro status flags for all users.
        </p>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>User Accounts</CardTitle>
          <CardDescription>
            Verified and Pro columns are manually controlled and persisted to the database.
          </CardDescription>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email, username, name, role"
            className="max-w-md"
          />
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading users...
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Registry</TableHead>
                    <TableHead>Verified</TableHead>
                    <TableHead>Pro</TableHead>
                    <TableHead>Profile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => {
                      const verifiedSaveKey = `${user.id}:is_verified`;
                      const proSaveKey = `${user.id}:is_pro`;
                      const isSavingVerified = !!savingState[verifiedSaveKey];
                      const isSavingPro = !!savingState[proSaveKey];

                      return (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-medium">
                                {user.role === 'Agent'
                                  ? user.agency_name || user.professional_name || user.legal_name
                                  : user.professional_name || user.legal_name}
                              </p>
                              <p className="text-xs text-muted-foreground">@{user.username}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{user.email}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{user.role}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {user.role === 'Agent' ? (
                              user.agent_registry_id ? (
                                <span className="font-mono">{user.agent_registry_id}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )
                            ) : user.registry_id ? (
                              <span className="font-mono">{user.registry_id}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant={user.is_verified ? 'default' : 'outline'}
                              size="sm"
                              disabled={isSavingVerified}
                              onClick={() =>
                                updateStatus(user.id, 'is_verified', !user.is_verified)
                              }
                              className={user.is_verified ? 'bg-green-600 hover:bg-green-700' : ''}
                            >
                              {isSavingVerified ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.is_verified ? (
                                <>
                                  <ShieldCheck className="h-4 w-4 mr-1" />
                                  Enabled
                                </>
                              ) : (
                                'Disabled'
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant={user.is_pro ? 'default' : 'outline'}
                              size="sm"
                              disabled={isSavingPro}
                              onClick={() => updateStatus(user.id, 'is_pro', !user.is_pro)}
                              className={
                                user.is_pro ? 'bg-amber-500 hover:bg-amber-600 text-black' : ''
                              }
                            >
                              {isSavingPro ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.is_pro ? (
                                <>
                                  <Star className="h-4 w-4 mr-1" />
                                  Enabled
                                </>
                              ) : (
                                'Disabled'
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            {user.profile_completed ? (
                              <span className="inline-flex items-center text-green-700 text-sm">
                                <Check className="h-4 w-4 mr-1" />
                                Complete
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Incomplete</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
