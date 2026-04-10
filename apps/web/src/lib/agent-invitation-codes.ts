import { query } from '@/lib/db';

export type InvitationCodeRecord = {
  id: string;
  code: string;
  agent_id: string;
  expires_at: string;
  redeemed_at: string | null;
  used_by_actor_id: string | null;
  agency_name: string | null;
  agent_profile_completed: boolean;
};

export async function getInvitationCodeForRedeem(code: string): Promise<InvitationCodeRecord | null> {
  const result = await query(
    `SELECT
       aic.id,
       aic.code,
       aic.agent_id,
       aic.expires_at,
       aic.redeemed_at,
       aic.used_by_actor_id,
       ag.agency_name,
       ag.profile_completed AS agent_profile_completed
     FROM agent_invitation_codes aic
     INNER JOIN agents ag ON ag.id = aic.agent_id
     WHERE aic.code = $1
       AND aic.deleted_at IS NULL
     LIMIT 1`,
    [code]
  );

  return (result.rows[0] as InvitationCodeRecord | undefined) || null;
}

export async function redeemInvitationCode(params: {
  invitationCodeId: string;
  actorId: string;
}) {
  const result = await query(
    `UPDATE agent_invitation_codes
     SET used_by_actor_id = $2,
         redeemed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1
       AND redeemed_at IS NULL
       AND deleted_at IS NULL
     RETURNING id, code, agent_id, used_by_actor_id, redeemed_at`,
    [params.invitationCodeId, params.actorId]
  );

  return result.rows[0] || null;
}
