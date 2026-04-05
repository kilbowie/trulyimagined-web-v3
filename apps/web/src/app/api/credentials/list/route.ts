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
import { decryptJSON } from '@trulyimagined/utils';
import type { VerifiableCredential } from '@/lib/verifiable-credentials';
import {
  getUserProfileByAuth0UserId,
  listCredentialsByProfileId,
} from '@/lib/hdicr/credentials-client';

function parseStoredCredential(value: unknown): VerifiableCredential {
  if (typeof value === 'string') {
    try {
      return decryptJSON<VerifiableCredential>(value);
    } catch {
      return JSON.parse(value) as VerifiableCredential;
    }
  }

  if (value && typeof value === 'object') {
    return value as VerifiableCredential;
  }

  throw new Error('Invalid credential format in storage');
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const auth0UserId = session.user.sub;

    const profile = await getUserProfileByAuth0UserId(auth0UserId);

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    // 3. Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeRevoked = searchParams.get('includeRevoked') === 'true';
    const includeExpired = searchParams.get('includeExpired') === 'true';

    const credentialsRows = await listCredentialsByProfileId({
      userProfileId: profile.id,
      includeRevoked,
      includeExpired,
    });

    // 6. Format response
    const credentials = credentialsRows.map((row) => {
      const credential = parseStoredCredential(row.credential_json);

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
