import { queryHdicr } from '@/lib/db';

export const DEFAULT_TENANT_ID = process.env.DEFAULT_TENANT_ID || 'trulyimagined';

export interface AdminContext {
  userProfileId: string;
  role: string;
}

export async function getAdminContext(auth0UserId: string): Promise<AdminContext | null> {
  const result = await queryHdicr(
    `SELECT id, role
     FROM user_profiles
     WHERE auth0_user_id = $1
     LIMIT 1`,
    [auth0UserId]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    userProfileId: row.id,
    role: row.role,
  };
}

export async function writeAuditLog(options: {
  userProfileId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, unknown>;
  tenantId?: string;
  userType?: 'admin' | 'actor' | 'agent' | 'system';
}): Promise<void> {
  await queryHdicr(
    `INSERT INTO audit_log (user_id, user_type, action, resource_type, resource_id, changes, tenant_id)
     VALUES ($1::uuid, $2, $3, $4, $5::uuid, $6::jsonb, $7)`,
    [
      options.userProfileId,
      options.userType || 'admin',
      options.action,
      options.resourceType,
      options.resourceId,
      JSON.stringify(options.changes),
      options.tenantId || DEFAULT_TENANT_ID,
    ]
  );
}
