import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth0 } from '@/lib/auth0';
import {
  createIdentityLink,
  getIdentityLinkByProviderAndProviderUser,
  getUserProfileIdByAuth0UserId,
  reactivateIdentityLink,
} from '@/lib/hdicr/identity-client';
import { validateBody, routeErrorResponse, extractCorrelationId } from '@/lib/validation';

const IdentityLinkSchema = z.object({
  provider: z.string().min(1),
  providerUserId: z.string().min(1),
  providerType: z.string().min(1),
  verificationLevel: z.enum(['low', 'medium', 'high', 'very-high']).optional(),
  assuranceLevel: z.enum(['low', 'substantial', 'high']).optional(),
  credentialData: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

/**
 * POST /api/identity/link
 * Links an external identity provider to the user's profile
 *
 * Step 7: Multi-Provider Identity Linking
 * Supports: Government IDs, Banks, KYC providers (Onfido, Yoti, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const validation = await validateBody(request, IdentityLinkSchema);
    if (!validation.ok) return validation.response;
    const {
      provider,
      providerUserId,
      providerType,
      verificationLevel,
      assuranceLevel,
      credentialData,
      metadata,
      expiresAt,
    } = validation.data;

    const userId = await getUserProfileIdByAuth0UserId(session.user.sub);
    if (!userId) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const correlationId = extractCorrelationId(request);

    const existingLink = await getIdentityLinkByProviderAndProviderUser(
      userId,
      provider,
      providerUserId
    );

    if (existingLink) {
      const existing = existingLink;

      // If exists but inactive, reactivate it
      if (!existing.is_active) {
        await reactivateIdentityLink(
          {
            linkId: existing.id,
            verificationLevel,
            assuranceLevel,
            credentialData,
            metadata,
            expiresAt,
          },
          correlationId
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

    const newLink = await createIdentityLink(
      {
        userProfileId: userId,
        provider,
        providerUserId,
        providerType,
        verificationLevel,
        assuranceLevel,
        credentialData,
        metadata,
        expiresAt,
      },
      correlationId
    );

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
    return routeErrorResponse(error);
  }
}
