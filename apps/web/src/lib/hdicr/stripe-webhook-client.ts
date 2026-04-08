import {
  createIdentityLink,
  getIdentityLinkByProviderAndProviderUser,
  reactivateIdentityLink,
  unlinkIdentityById,
} from '@/lib/hdicr/identity-client';

const STRIPE_PROVIDER = 'stripe-identity';

type StripeIdentityLink = {
  id?: string;
  user_profile_id?: string;
  is_active?: boolean;
};

export async function getStripeIdentityLinkBySessionId(sessionId: string, userProfileId: string) {
  return (await getIdentityLinkByProviderAndProviderUser(
    userProfileId,
    STRIPE_PROVIDER,
    sessionId
  )) as StripeIdentityLink | null;
}

export async function updateStripeIdentityLinkVerified(params: {
  linkId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
  verifiedAt: Date;
}) {
  await reactivateIdentityLink({
    linkId: params.linkId,
    verificationLevel: params.verificationLevel,
    assuranceLevel: params.assuranceLevel,
    credentialData: params.encryptedCredentialData,
    metadata: {
      ...params.metadata,
      verified_at: params.verifiedAt.toISOString(),
    },
  });
}

export async function createStripeIdentityLinkVerified(params: {
  userProfileId: string;
  sessionId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
  verifiedAt: Date;
}) {
  const created = (await createIdentityLink({
    userProfileId: params.userProfileId,
    provider: STRIPE_PROVIDER,
    providerUserId: params.sessionId,
    providerType: 'kyc',
    verificationLevel: params.verificationLevel,
    assuranceLevel: params.assuranceLevel,
    credentialData: params.encryptedCredentialData,
    metadata: {
      ...params.metadata,
      verified_at: params.verifiedAt.toISOString(),
    },
  })) as { id?: string; link?: { id?: string } } | null;

  const id = created?.id ?? created?.link?.id;
  return id ? { id } : null;
}

export async function updateStripeIdentityLinkRequiresInput(params: {
  linkId: string;
  verificationLevel: string;
  assuranceLevel: string;
  metadata: Record<string, unknown>;
}) {
  await reactivateIdentityLink({
    linkId: params.linkId,
    verificationLevel: params.verificationLevel,
    assuranceLevel: params.assuranceLevel,
    metadata: params.metadata,
  });
}

export async function createStripeIdentityLinkRequiresInput(params: {
  userProfileId: string;
  sessionId: string;
  verificationLevel: string;
  assuranceLevel: string;
  encryptedCredentialData: unknown;
  metadata: Record<string, unknown>;
}) {
  await createIdentityLink({
    userProfileId: params.userProfileId,
    provider: STRIPE_PROVIDER,
    providerUserId: params.sessionId,
    providerType: 'kyc',
    verificationLevel: params.verificationLevel,
    assuranceLevel: params.assuranceLevel,
    credentialData: params.encryptedCredentialData,
    metadata: params.metadata,
  });
}

export async function markStripeIdentityLinkCanceled(
  linkId: string,
  metadata: Record<string, unknown>,
  userProfileId: string
) {
  void metadata;
  const rows = await unlinkIdentityById(linkId, userProfileId);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('[HDICR] Failed to mark stripe identity link as canceled.');
  }
}
