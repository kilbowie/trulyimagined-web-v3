import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import {
  createIdentityLink,
  getIdentityLinkByProviderAndProviderUser,
  getUserProfileIdByAuth0UserId,
  reactivateIdentityLink,
} from '@/lib/hdicr/identity-client';

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

    const userId = await getUserProfileIdByAuth0UserId(session.user.sub);
    if (!userId) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const existingLink = await getIdentityLinkByProviderAndProviderUser(userId, provider, providerUserId);

    if (existingLink) {
      const existing = existingLink;

      // If exists but inactive, reactivate it
      if (!existing.is_active) {
        await reactivateIdentityLink({
          linkId: existing.id,
          verificationLevel,
          assuranceLevel,
          credentialData,
          metadata,
          expiresAt,
        });

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

    const newLink = await createIdentityLink({
      userProfileId: userId,
      provider,
      providerUserId,
      providerType,
      verificationLevel,
      assuranceLevel,
      credentialData,
      metadata,
      expiresAt,
    });

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
