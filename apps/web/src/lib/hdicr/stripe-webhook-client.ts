import { verifyIdentityConfirmed } from '@/lib/hdicr/identity-client';

export async function verifyStripeIdentityConfirmed(params: {
  tiUserId: string;
  verificationSessionId: string;
  verifiedAt: string;
  assuranceLevel: string;
}) {
  await verifyIdentityConfirmed(params);
}
