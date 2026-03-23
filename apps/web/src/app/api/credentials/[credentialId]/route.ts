/**
 * GET /api/credentials/[credentialId]
 * 
 * Retrieve a W3C Verifiable Credential by ID
 * 
 * Requirements:
 * - User must be authenticated
 * - User must own the credential (or have admin role)
 * 
 * Query Parameters:
 * - download=true: Download as .json file
 * - verify=true: Include verification status
 * 
 * Response:
 * {
 *   "success": true,
 *   "credential": { ...W3C VC... },
 *   "metadata": {
 *     "id": "uuid",
 *     "issuedAt": "2024-01-01T00:00:00Z",
 *     "expiresAt": "2025-01-01T00:00:00Z",
 *     "isRevoked": false,
 *     "credentialType": "IdentityCredential"
 *   },
 *   "verification": { ... } // if verify=true
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { pool } from '@/lib/db';
import { verifyCredential, type VerifiableCredential } from '@/lib/verifiable-credentials';

// ===========================================
// GET /api/credentials/[credentialId]
// ===========================================

export async function GET(
  request: NextRequest,
  { params }: { params: { credentialId: string } }
) {
  try {
    const credentialId = params.credentialId;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(credentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid credential ID format' },
        { status: 400 }
      );
    }

    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const auth0UserId = session.user.sub;

    // 2. Get user profile
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

    // 3. Fetch credential from database
    const credentialResult = await pool.query(
      `SELECT 
        id,
        user_profile_id,
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
      WHERE id = $1`,
      [credentialId]
    );

    if (credentialResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      );
    }

    const credentialData = credentialResult.rows[0];

    // 4. Authorization check: User must own the credential or be Admin
    if (
      credentialData.user_profile_id !== profile.id &&
      profile.role !== 'Admin'
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You do not own this credential' },
        { status: 403 }
      );
    }

    // 5. Parse credential JSON
    const credential: VerifiableCredential = credentialData.credential_json;

    // 6. Build metadata
    const metadata = {
      id: credentialData.id,
      credentialType: credentialData.credential_type,
      issuedAt: credentialData.issued_at,
      expiresAt: credentialData.expires_at,
      isRevoked: credentialData.is_revoked,
      revokedAt: credentialData.revoked_at,
      revocationReason: credentialData.revocation_reason,
      issuerDid: credentialData.issuer_did,
      holderDid: credentialData.holder_did,
      verificationMethod: credentialData.verification_method,
      proofType: credentialData.proof_type,
    };

    // 7. Check query parameters
    const { searchParams } = new URL(request.url);
    const shouldDownload = searchParams.get('download') === 'true';
    const shouldVerify = searchParams.get('verify') === 'true';

    // 8. Verify credential if requested
    let verification;
    if (shouldVerify) {
      verification = await verifyCredential(credential);
    }

    // 9. Download as file
    if (shouldDownload) {
      const filename = `credential-${credentialId}.json`;
      return NextResponse.json(credential, {
        headers: {
          'Content-Type': 'application/ld+json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // 10. Return credential with metadata
    return NextResponse.json({
      success: true,
      credential,
      metadata,
      ...(verification && { verification }),
    });
  } catch (error) {
    console.error('Error retrieving credential:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve credential',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ===========================================
// DELETE /api/credentials/[credentialId]
// Revoke a credential
// ===========================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { credentialId: string } }
) {
  try {
    const credentialId = params.credentialId;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(credentialId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid credential ID format' },
        { status: 400 }
      );
    }

    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const auth0UserId = session.user.sub;

    // 2. Get user profile
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

    // 3. Check ownership
    const ownershipResult = await pool.query(
      `SELECT user_profile_id FROM verifiable_credentials WHERE id = $1`,
      [credentialId]
    );

    if (ownershipResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      );
    }

    const ownerId = ownershipResult.rows[0].user_profile_id;

    // Only owner or Admin can revoke
    if (ownerId !== profile.id && profile.role !== 'Admin') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: You cannot revoke this credential' },
        { status: 403 }
      );
    }

    // 4. Parse optional revocation reason
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'Revoked by user';

    // 5. Revoke the credential
    await pool.query(
      `UPDATE verifiable_credentials
       SET is_revoked = TRUE,
           revoked_at = NOW(),
           revocation_reason = $2
       WHERE id = $1`,
      [credentialId, reason]
    );

    return NextResponse.json({
      success: true,
      message: 'Credential revoked successfully',
      credentialId,
      revokedAt: new Date().toISOString(),
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
