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
import { pool } from '@/lib/db';
import {
  issueCredential,
  getCredentialTypeForUser,
  CredentialTypeSchema,
} from '@/lib/verifiable-credentials';
import { z } from 'zod';

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
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
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

    // 3. Fetch user profile from database
    const profileResult = await pool.query(
      `SELECT 
        id, 
        auth0_user_id, 
        email, 
        username, 
        legal_name, 
        professional_name, 
        role,
        profile_completed
      FROM user_profiles 
      WHERE auth0_user_id = $1`,
      [auth0UserId]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User profile not found' },
        { status: 404 }
      );
    }

    const profile = profileResult.rows[0];

    if (!profile.profile_completed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile incomplete. Please complete your profile first.',
        },
        { status: 400 }
      );
    }

    // 4. Fetch identity links (verifications)
    const linksResult = await pool.query(
      `SELECT 
        provider, 
        verification_level, 
        assurance_level,
        verified_at,
        is_active
      FROM identity_links 
      WHERE user_profile_id = $1 
        AND is_active = TRUE
      ORDER BY verified_at DESC`,
      [profile.id]
    );

    if (linksResult.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No verified identity. Please verify your identity first.',
        },
        { status: 400 }
      );
    }

    const identityLinks = linksResult.rows;

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

    // 8. Issue the Verifiable Credential
    const credential = await issueCredential({
      credentialType,
      holderDid,
      holderProfileId: profile.id,
      claims,
      expiresInDays: expiresInDays || undefined,
    });

    // 9. Store credential in database (W3C VC 2.0 format)
    const insertResult = await pool.query(
      `INSERT INTO verifiable_credentials (
        user_profile_id,
        credential_type,
        credential_json,
        issuer_did,
        holder_did,
        issued_at,
        expires_at,
        verification_method,
        proof_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        profile.id,
        credentialType,
        JSON.stringify(credential),
        'did:web:trulyimagined.com',
        holderDid,
        credential.validFrom, // W3C VC 2.0: was issuanceDate
        credential.validUntil || null, // W3C VC 2.0: was expirationDate
        'did:web:trulyimagined.com#key-1',
        'Ed25519Signature2020',
      ]
    );

    const credentialId = insertResult.rows[0].id;

    // 10. Return credential to user
    return NextResponse.json({
      success: true,
      credential,
      credentialId,
      downloadUrl: `/api/credentials/${credentialId}`,
      holderDid,
      message: 'Verifiable Credential issued successfully',
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
