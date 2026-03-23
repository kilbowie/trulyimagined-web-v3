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
import { pool } from '@/lib/db';
import { updateCredentialStatus } from '@/lib/status-list-manager';
import { z } from 'zod';

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

    // 3. Fetch user profile
    const profileResult = await pool.query(
      `SELECT id, role FROM user_profiles WHERE auth0_user_id = $1`,
      [auth0UserId]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const profile = profileResult.rows[0];

    // 4. Fetch credential
    const credentialResult = await pool.query(
      `SELECT user_profile_id, is_revoked, credential_type 
       FROM verifiable_credentials 
       WHERE id = $1`,
      [credentialId]
    );

    if (credentialResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Credential not found' }, { status: 404 });
    }

    const credential = credentialResult.rows[0];

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

    // 6. Check if already revoked
    if (credential.is_revoked) {
      return NextResponse.json(
        {
          success: false,
          error: 'Credential is already revoked',
        },
        { status: 400 }
      );
    }

    // 7. Revoke credential (update bitstring status list)
    await updateCredentialStatus(pool, {
      credentialId,
      statusPurpose: 'revocation',
      statusValue: 1, // 1 = revoked
    });

    // 8. Update revocation reason if provided
    if (reason) {
      await pool.query(
        `UPDATE verifiable_credentials 
         SET revocation_reason = $1, updated_at = NOW() 
         WHERE id = $2`,
        [reason, credentialId]
      );
    }

    // 9. Get updated credential info
    const updatedResult = await pool.query(
      `SELECT revoked_at FROM verifiable_credentials WHERE id = $1`,
      [credentialId]
    );

    const revokedAt = updatedResult.rows[0].revoked_at;

    // 10. Return success response
    return NextResponse.json({
      success: true,
      message: 'Credential revoked successfully',
      credentialId,
      revokedAt,
      reason: reason || null,
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
