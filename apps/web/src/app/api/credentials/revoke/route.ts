/**
 * POST /api/credentials/revoke
 *
 * Revoke a Verifiable Credential
 *
 * Standards: W3C Bitstring Status List v1.0
 *
 * Requirements:
 * - User must be authenticated (Auth0 JWT)
 * - User must be admin OR credential owner
 *
 * Request Body:
 * {
 *   "credentialId": "uuid",
 *   "reason": "Identity compromised" (optional)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "message": "Credential revoked successfully",
 *   "credentialId": "uuid",
 *   "revokedAt": "2024-01-15T10:30:00Z"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { z } from 'zod';
import {
  getCredentialById,
  getUserProfileByAuth0UserId,
  revokeCredentialById,
} from '@/lib/hdicr/credentials-client';

// ===========================================
// REQUEST SCHEMA
// ===========================================

const RevokeCredentialRequestSchema = z.object({
  credentialId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// ===========================================
// POST /api/credentials/revoke
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
    const validationResult = RevokeCredentialRequestSchema.safeParse(body);

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

    const { credentialId, reason } = validationResult.data;

    const profile = await getUserProfileByAuth0UserId(auth0UserId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const credential = await getCredentialById(credentialId);

    if (!credential) {
      return NextResponse.json({ success: false, error: 'Credential not found' }, { status: 404 });
    }

    // 5. Authorization check: user must own credential OR be admin
    const isOwner = credential.user_profile_id === profile.id;
    const isAdmin = profile.role === 'Admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden: You do not have permission to revoke this credential',
        },
        { status: 403 }
      );
    }

    if (credential.is_revoked) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credential is already revoked',
        },
        { status: 400 }
      );
    }

    const revokeResult = await revokeCredentialById(credentialId, reason);

    if (!revokeResult.found) {
      return NextResponse.json({ success: false, error: 'Credential not found' }, { status: 404 });
    }

    if (revokeResult.alreadyRevoked) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credential is already revoked',
        },
        { status: 400 }
      );
    }

    const revokedAt = revokeResult.revokedAt;

    // 11. Return success response
    return NextResponse.json({
      success: true,
      message: revokeResult.hasStatusEntry
        ? 'Credential revoked successfully (W3C Bitstring Status List updated)'
        : 'Legacy credential revoked successfully (database-only revocation)',
      credentialId,
      revokedAt,
      reason: reason || null,
      legacy: !revokeResult.hasStatusEntry,
    });
  } catch (error) {
    console.error('Error revoking credential:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to revoke credential',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
