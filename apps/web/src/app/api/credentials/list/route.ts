/**
 * GET /api/credentials/list
 *
 * List all Verifiable Credentials for the authenticated user
 *
 * Query Parameters:
 * - includeRevoked=true: Include revoked credentials
 * - includeExpired=true: Include expired credentials
 *
 * Response:
 * {
 *   "success": true,
 *   "credentials": [
 *     {
 *       "credential": { ...W3C VC... },
 *       "metadata": { ... }
 *     }
 *   ],
 *   "count": 5
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { pool } from '@/lib/db';
import { decryptJSON } from '@trulyimagined/utils';
import type { VerifiableCredential } from '@/lib/verifiable-credentials';

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    // 2. Get user profile
    const profileResult = await pool.query(
      `SELECT id FROM user_profiles WHERE auth0_user_id = $1`,
      [auth0UserId]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const profile = profileResult.rows[0];

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeRevoked = searchParams.get('includeRevoked') === 'true';
    const includeExpired = searchParams.get('includeExpired') === 'true';

    // 4. Build query
    let query = `
      SELECT 
        id,
        credential_type,
        credential_json,
        issuer_did,
        holder_did,
        issued_at,
        expires_at,
        is_revoked,
        revoked_at,
        revocation_reason,
        verification_method,
        proof_type
      FROM verifiable_credentials
      WHERE user_profile_id = $1
    `;

    if (!includeRevoked) {
      query += ' AND is_revoked = FALSE';
    }

    if (!includeExpired) {
      query += ' AND (expires_at IS NULL OR expires_at > NOW())';
    }

    query += ' ORDER BY issued_at DESC';

    // 5. Fetch credentials
    const credentialsResult = await pool.query(query, [profile.id]);

    // 6. Format response
    const credentials = credentialsResult.rows.map((row) => {
      // Decrypt credential_json from database (Step 11: Database Encryption)
      const credential: VerifiableCredential = decryptJSON(row.credential_json);

      return {
        credential,
        metadata: {
          id: row.id,
          credentialType: row.credential_type,
          issuedAt: row.issued_at,
          expiresAt: row.expires_at,
          isRevoked: row.is_revoked,
          revokedAt: row.revoked_at,
          revocationReason: row.revocation_reason,
          issuerDid: row.issuer_did,
          holderDid: row.holder_did,
          verificationMethod: row.verification_method,
          proofType: row.proof_type,
        },
      };
    });

    return NextResponse.json({
      success: true,
      credentials,
      count: credentials.length,
    });
  } catch (error) {
    console.error('Error listing credentials:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list credentials',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
