import { randomInt } from 'crypto';
import { query } from '@/lib/db';

const DEFAULT_MAX_ATTEMPTS = 10;

export function generateRegistryId(): string {
  const nextPart = () => randomInt(1000, 10000).toString();
  return `${nextPart()}-${nextPart()}-${nextPart()}`;
}

export async function createUniqueRegistryId(maxAttempts = DEFAULT_MAX_ATTEMPTS): Promise<string> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const registryId = generateRegistryId();
    const existing = await query('SELECT 1 FROM actors WHERE registry_id = $1', [registryId]);

    if (existing.rows.length === 0) {
      return registryId;
    }

    attempts += 1;
  }

  throw new Error('Failed to generate unique Registry ID. Please try again.');
}

export async function ensureActorRegistryId(
  actorId: string,
  existingRegistryId?: string | null
): Promise<string> {
  if (existingRegistryId && existingRegistryId.trim().length > 0) {
    return existingRegistryId;
  }

  const registryId = await createUniqueRegistryId();
  const updateResult = await query(
    `UPDATE actors
     SET registry_id = $1,
         updated_at = NOW()
     WHERE id = $2
       AND (registry_id IS NULL OR registry_id = '')
     RETURNING registry_id`,
    [registryId, actorId]
  );

  if (updateResult.rows.length > 0 && updateResult.rows[0].registry_id) {
    return updateResult.rows[0].registry_id as string;
  }

  const actorResult = await query('SELECT registry_id FROM actors WHERE id = $1', [actorId]);
  const persistedRegistryId = actorResult.rows[0]?.registry_id as string | undefined;

  if (persistedRegistryId && persistedRegistryId.trim().length > 0) {
    return persistedRegistryId;
  }

  throw new Error('Unable to assign Registry ID to actor record.');
}

export async function createUniqueAgentRegistryId(
  maxAttempts = DEFAULT_MAX_ATTEMPTS
): Promise<string> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const registryId = generateRegistryId();
    const existing = await query('SELECT 1 FROM agents WHERE registry_id = $1', [registryId]);

    if (existing.rows.length === 0) {
      return registryId;
    }

    attempts += 1;
  }

  throw new Error('Failed to generate unique Agent Registry ID. Please try again.');
}

export async function ensureAgentRegistryId(
  agentId: string,
  existingRegistryId?: string | null
): Promise<string> {
  if (existingRegistryId && existingRegistryId.trim().length > 0) {
    return existingRegistryId;
  }

  const registryId = await createUniqueAgentRegistryId();
  const updateResult = await query(
    `UPDATE agents
     SET registry_id = $1,
         updated_at = NOW()
     WHERE id = $2
       AND (registry_id IS NULL OR registry_id = '')
     RETURNING registry_id`,
    [registryId, agentId]
  );

  if (updateResult.rows.length > 0 && updateResult.rows[0].registry_id) {
    return updateResult.rows[0].registry_id as string;
  }

  const agentResult = await query('SELECT registry_id FROM agents WHERE id = $1', [agentId]);
  const persistedRegistryId = agentResult.rows[0]?.registry_id as string | undefined;

  if (persistedRegistryId && persistedRegistryId.trim().length > 0) {
    return persistedRegistryId;
  }

  throw new Error('Unable to assign Registry ID to agent record.');
}
