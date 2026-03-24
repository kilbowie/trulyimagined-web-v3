import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';
import { encryptJSON } from '@trulyimagined/utils';

/**
 * POST /api/identity/link
 * Links an external identity provider to the user's profile
 *
 * Step 7: Multi-Provider Identity Linking
 * Supports: Government IDs, Banks, KYC providers (Onfido, Yoti, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    // Get Auth0 session
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      provider,
      providerUserId,
      providerType,
      verificationLevel,
      assuranceLevel,
      credentialData,
      metadata,
      expiresAt,
    } = body;

    // Validation
    if (!provider || !providerUserId || !providerType) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          required: ['provider', 'providerUserId', 'providerType'],
        },
        { status: 400 }
      );
    }

    // Validate verification level
    const validVerificationLevels = ['low', 'medium', 'high', 'very-high'];
    if (verificationLevel && !validVerificationLevels.includes(verificationLevel)) {
      return NextResponse.json(
        {
          error: 'Invalid verification level',
          valid: validVerificationLevels,
        },
        { status: 400 }
      );
    }

    // Validate assurance level (eIDAS)
    const validAssuranceLevels = ['low', 'substantial', 'high'];
    if (assuranceLevel && !validAssuranceLevels.includes(assuranceLevel)) {
      return NextResponse.json(
        {
          error: 'Invalid assurance level',
          valid: validAssuranceLevels,
        },
        { status: 400 }
      );
    }

    // Get user profile ID from Auth0 user ID
    const userResult = await query(`SELECT id FROM user_profiles WHERE auth0_user_id = $1`, [
      session.user.sub,
    ]);

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    // Check if link already exists
    const existingLink = await query(
      `SELECT id, is_active FROM identity_links 
       WHERE user_profile_id = $1 AND provider = $2 AND provider_user_id = $3`,
      [userId, provider, providerUserId]
    );

    if (existingLink.rows.length > 0) {
      const existing = existingLink.rows[0];

      // If exists but inactive, reactivate it
      if (!existing.is_active) {
        // Encrypt credential_data before storing (Step 11: Database Encryption)
        const encryptedCredentialData = credentialData ? encryptJSON(credentialData) : null;
        
        await query(
          `UPDATE identity_links 
           SET is_active = TRUE, 
               linked_at = NOW(), 
               verification_level = COALESCE($1, verification_level),
               assurance_level = COALESCE($2, assurance_level),
               credential_data = COALESCE($3, credential_data),
               metadata = COALESCE($4, metadata),
               expires_at = $5,
               last_verified_at = NOW(),
               updated_at = NOW()
           WHERE id = $6`,
          [
            verificationLevel || null,
            assuranceLevel || null,
            encryptedCredentialData,
            metadata ? JSON.stringify(metadata) : null,
            expiresAt || null,
            existing.id,
          ]
        );

        console.log('[IDENTITY-LINK] Reactivated existing link:', {
          linkId: existing.id,
          userId,
          provider,
        });

        return NextResponse.json(
          {
            success: true,
            linkId: existing.id,
            provider,
            verificationLevel: verificationLevel || 'medium',
            message: 'Identity provider link reactivated',
          },
          { status: 200 }
        );
      }

      // Already active - return existing
      return NextResponse.json(
        {
          success: true,
          linkId: existing.id,
          provider,
          message: 'Identity provider already linked',
        },
        { status: 200 }
      );
    }

    // Create new identity link
    // Encrypt credential_data before storing (Step 11: Database Encryption)
    const encryptedCredentialData = credentialData ? encryptJSON(credentialData) : null;
    
    const result = await query(
      `INSERT INTO identity_links (
        user_profile_id,
        provider,
        provider_user_id,
        provider_type,
        verification_level,
        assurance_level,
        credential_data,
        metadata,
        verified_at,
        expires_at,
        last_verified_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, NOW())
      RETURNING id, provider, verification_level, assurance_level`,
      [
        userId,
        provider,
        providerUserId,
        providerType,
        verificationLevel || 'medium',
        assuranceLevel || null,
        encryptedCredentialData,
        metadata ? JSON.stringify(metadata) : null,
        expiresAt || null,
      ]
    );

    const newLink = result.rows[0];

    console.log('[IDENTITY-LINK] Created new identity link:', {
      linkId: newLink.id,
      userId,
      provider,
      verificationLevel: newLink.verification_level,
      assuranceLevel: newLink.assurance_level,
    });

    return NextResponse.json(
      {
        success: true,
        linkId: newLink.id,
        provider: newLink.provider,
        verificationLevel: newLink.verification_level,
        assuranceLevel: newLink.assurance_level,
        message: 'Identity provider linked successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[IDENTITY-LINK] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to link identity provider',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
