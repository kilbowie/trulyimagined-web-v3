/**
 * POST /api/credentials/issue
 *
 * Issue a W3C Verifiable Credential to an authenticated user
 *
 * Standards: W3C Verifiable Credentials Data Model 2.0
 *
 * Requirements:
 * - User must be authenticated (Auth0 JWT)
 * - User must have completed profile
 * - User must have at least one verified identity link
 *
 * Request Body:
 * {
 *   "credentialType": "IdentityCredential" | "AgentCredential" | "ActorCredential" | etc.
 *   "expiresInDays": 365 (optional, default: no expiration)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "credential": { ...W3C VC 2.0... },
 *   "credentialId": "uuid",
 *   "downloadUrl": "/api/credentials/{uuid}"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import {
  issueCredential,
  getCredentialTypeForUser,
  CredentialTypeSchema,
} from '@/lib/verifiable-credentials';
import { z } from 'zod';
import {
  allocateRevocationStatusForCredential,
  createCredentialPlaceholderRecord,
  finalizeIssuedCredentialRecord,
  getIssuanceProfileByAuth0UserId,
  listActiveIdentityLinksByUserProfileId,
} from '@/lib/hdicr/credentials-client';

// ===========================================
// REQUEST SCHEMA
// ===========================================

const IssueCredentialRequestSchema = z.object({
  credentialType: CredentialTypeSchema.optional(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

// ===========================================
// POST /api/credentials/issue
// ===========================================

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    // 2. Parse request body
    const body = await request.json();
    const validationResult = IssueCredentialRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { credentialType: requestedType, expiresInDays } = validationResult.data;

    const profile = await getIssuanceProfileByAuth0UserId(auth0UserId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Actor registration can be treated as a complete profile for issuance eligibility.
    const hasActorProfile = !!profile.actor_id;
    const profileComplete = !!profile.profile_completed || hasActorProfile;

    if (!profileComplete) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile incomplete. Please complete your profile first.',
        },
        { status: 400 }
      );
    }

    let identityLinks = await listActiveIdentityLinksByUserProfileId(profile.id);

    // Allow verified accounts without an explicit identity_links record.
    // This supports production manual verification flags and actor verification status.
    if (identityLinks.length === 0) {
      const manuallyVerified = !!profile.is_verified;
      const actorVerified = profile.actor_verification_status === 'verified';

      if (manuallyVerified) {
        identityLinks = [
          {
            provider: 'IAM Verification',
            verification_level: 'high',
            assurance_level: 'high',
            verified_at: new Date().toISOString(),
            is_active: true,
          },
        ];
      } else if (actorVerified) {
        identityLinks = [
          {
            provider: 'Actor Registry Verification',
            verification_level: 'high',
            assurance_level: 'high',
            verified_at: profile.actor_verified_at || new Date().toISOString(),
            is_active: true,
          },
        ];
      } else if (process.env.NODE_ENV !== 'production') {
        // Development fallback so local credential issuance is always testable.
        identityLinks = [
          {
            provider: 'Development Mock Verification',
            verification_level: 'medium',
            assurance_level: 'substantial',
            verified_at: new Date().toISOString(),
            is_active: true,
          },
        ];
      } else {
        return NextResponse.json(
          {
            success: false,
            error:
              'No verified identity. Complete verification in Verify Identity or have an admin set your account as verified.',
          },
          { status: 400 }
        );
      }
    }

    // Find highest verification level
    const verificationLevels = ['low', 'medium', 'high', 'very-high'];
    const highestLevel = identityLinks.reduce((max, link) => {
      const currentIndex = verificationLevels.indexOf(link.verification_level || 'low');
      const maxIndex = verificationLevels.indexOf(max);
      return currentIndex > maxIndex ? link.verification_level : max;
    }, 'low');

    // 5. Determine credential type
    const credentialType = requestedType || getCredentialTypeForUser(profile.role);

    // 6. Build credential claims
    const claims = {
      email: profile.email,
      username: profile.username,
      legalName: profile.legal_name,
      professionalName: profile.professional_name,
      role: profile.role,
      verificationLevel: highestLevel,
      identityProviders: identityLinks.map((link) => ({
        provider: link.provider,
        verificationLevel: link.verification_level,
        assuranceLevel: link.assurance_level,
        verifiedAt: link.verified_at,
      })),
      issuedFor: 'Truly Imagined Identity Orchestration',
    };

    // 7. Generate user's DID
    const holderDid = `did:web:trulyimagined.com:users:${profile.id}`;

    const credentialDbId = await createCredentialPlaceholderRecord({
      userProfileId: profile.id,
      credentialType,
      holderDid,
    });

    // 9. Allocate status list index for revocation
    const credentialStatus = await allocateRevocationStatusForCredential(credentialDbId);

    // 10. Issue the Verifiable Credential with status
    const credential = await issueCredential({
      credentialType,
      holderDid,
      holderProfileId: profile.id,
      claims,
      expiresInDays: expiresInDays || undefined,
      credentialStatus, // Include W3C Bitstring Status List entry
    });

    await finalizeIssuedCredentialRecord({
      credentialDbId,
      credential,
    });

    // 12. Return credential to user
    return NextResponse.json({
      success: true,
      credential,
      credentialId: credentialDbId,
      downloadUrl: `/api/credentials/${credentialDbId}`,
      holderDid,
      message: 'Verifiable Credential issued successfully (with revocation status)',
    });
  } catch (error) {
    console.error('Error issuing credential:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to issue credential',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
