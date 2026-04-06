/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook endpoint for Identity verification events
 *
 * Step 7: Multi-Provider Identity Linking
 * Handles: identity.verification_session.verified, identity.verification_session.requires_input
 *
 * Setup:
 * 1. Configure webhook in Stripe Dashboard: https://dashboard.stripe.com/webhooks
 * 2. Add endpoint URL: https://yourdomain.com/api/webhooks/stripe
 * 3. Select events: identity.verification_session.*
 * 4. Copy webhook signing secret to STRIPE_WEBHOOK_SECRET env var
 *
 * @see https://stripe.com/docs/identity/verify-identity-documents#handle-verification-outcomes
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe, mapStripeStatusToVerificationLevel, getVerifiedIdentityData } from '@/lib/stripe';
import {
  createStripeIdentityLinkRequiresInput,
  createStripeIdentityLinkVerified,
  getStripeIdentityLinkBySessionId,
  markStripeIdentityLinkCanceled,
  updateStripeIdentityLinkRequiresInput,
  updateStripeIdentityLinkVerified,
} from '@/lib/hdicr/stripe-webhook-client';
import { encryptJSON } from '@trulyimagined/utils';
import Stripe from 'stripe';

/**
 * Webhook handler - must be POST route with raw body
 * Next.js automatically parses body, so we need to use raw request
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[STRIPE WEBHOOK] Missing stripe-signature header');
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const error = err as Error;
      console.error('[STRIPE WEBHOOK] Signature verification failed:', error.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${error.message}` },
        { status: 400 }
      );
    }

    console.log('[STRIPE WEBHOOK] Received event:', {
      type: event.type,
      id: event.id,
    });

    // Handle verification session events
    switch (event.type) {
      case 'identity.verification_session.verified':
        await handleVerificationVerified(event.data.object as Stripe.Identity.VerificationSession);
        break;

      case 'identity.verification_session.requires_input':
        await handleVerificationRequiresInput(
          event.data.object as Stripe.Identity.VerificationSession
        );
        break;

      case 'identity.verification_session.processing':
        await handleVerificationProcessing(
          event.data.object as Stripe.Identity.VerificationSession
        );
        break;

      case 'identity.verification_session.canceled':
        await handleVerificationCanceled(event.data.object as Stripe.Identity.VerificationSession);
        break;

      default:
        console.log('[STRIPE WEBHOOK] Unhandled event type:', event.type);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error processing webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Webhook processing failed', message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Handle successful verification
 * Creates identity_link record with verified status
 */
async function handleVerificationVerified(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    console.error('[STRIPE WEBHOOK] Missing user_profile_id in session metadata');
    return;
  }

  console.log('[STRIPE WEBHOOK] Processing verified session:', {
    sessionId: session.id,
    userProfileId,
    status: session.status,
  });

  try {
    // Get verified identity data
    const verifiedData = await getVerifiedIdentityData(session.id);

    if (!verifiedData) {
      console.error('[STRIPE WEBHOOK] Failed to get verified identity data');
      return;
    }

    // Map Stripe status to verification levels
    const levels = mapStripeStatusToVerificationLevel('verified');

    // Check if identity link already exists for this session
    const existingLink = await getStripeIdentityLinkBySessionId(session.id);

    if (existingLink) {
      console.log('[STRIPE WEBHOOK] Identity link already exists, updating:', {
        linkId: existingLink.id,
      });

      // Encrypt credential_data before storing (Step 11: Database Encryption)
      const encryptedCredentialData = encryptJSON(verifiedData);

      // Update existing link
      await updateStripeIdentityLinkVerified({
        linkId: existingLink.id,
        verificationLevel: levels.verification_level,
        assuranceLevel: levels.assurance_level,
        encryptedCredentialData,
        metadata: {
          stripe_session_id: session.id,
          gpg45_confidence: levels.gpg45_confidence,
          eidas_level: levels.eidas_level,
          last_error: session.last_error?.reason || null,
          verified_at: new Date().toISOString(),
        },
        verifiedAt: new Date(),
      });

      console.log('[STRIPE WEBHOOK] Updated existing identity link');
    } else {
      // Encrypt credential_data before storing (Step 11: Database Encryption)
      const encryptedCredentialData = encryptJSON(verifiedData);

      // Create new identity link
      const linkResult = await createStripeIdentityLinkVerified({
        userProfileId,
        sessionId: session.id,
        verificationLevel: levels.verification_level,
        assuranceLevel: levels.assurance_level,
        encryptedCredentialData,
        metadata: {
          stripe_session_id: session.id,
          gpg45_confidence: levels.gpg45_confidence,
          eidas_level: levels.eidas_level,
          verified_at: new Date().toISOString(),
        },
        verifiedAt: new Date(),
      });

      const linkId = linkResult?.id;

      console.log('[STRIPE WEBHOOK] Created identity link:', {
        linkId,
        userProfileId,
        sessionId: session.id,
        verificationLevel: levels.verification_level,
      });
    }
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Error creating/updating identity link:', error);
    throw error;
  }
}

/**
 * Handle verification that requires additional input
 * Updates identity_link with medium verification level
 */
async function handleVerificationRequiresInput(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    console.error('[STRIPE WEBHOOK] Missing user_profile_id in session metadata');
    return;
  }

  console.log('[STRIPE WEBHOOK] Processing requires_input session:', {
    sessionId: session.id,
    userProfileId,
    lastError: session.last_error?.reason,
  });

  // Map Stripe status to verification levels
  const levels = mapStripeStatusToVerificationLevel('requires_input');

  // Check if identity link exists
  const existingLink = await getStripeIdentityLinkBySessionId(session.id);

  if (existingLink) {
    // Update existing link with requires_input status
    await updateStripeIdentityLinkRequiresInput({
      linkId: existingLink.id,
      verificationLevel: levels.verification_level,
      assuranceLevel: levels.assurance_level,
      metadata: {
        stripe_session_id: session.id,
        gpg45_confidence: levels.gpg45_confidence,
        eidas_level: levels.eidas_level,
        last_error: session.last_error?.reason || 'requires_input',
        status: 'requires_input',
      },
    });

    console.log('[STRIPE WEBHOOK] Updated identity link to requires_input status');
  } else {
    // Encrypt credential_data before storing (Step 11: Database Encryption)
    const credentialData = {
      status: 'requires_input',
      last_error: session.last_error?.reason,
    };
    const encryptedCredentialData = encryptJSON(credentialData);

    // Create new link with requires_input status
    await createStripeIdentityLinkRequiresInput({
      userProfileId,
      sessionId: session.id,
      verificationLevel: levels.verification_level,
      assuranceLevel: levels.assurance_level,
      encryptedCredentialData,
      metadata: {
        stripe_session_id: session.id,
        gpg45_confidence: levels.gpg45_confidence,
        eidas_level: levels.eidas_level,
        last_error: session.last_error?.reason || 'requires_input',
        status: 'requires_input',
      },
    });

    console.log('[STRIPE WEBHOOK] Created identity link with requires_input status');
  }
}

/**
 * Handle verification that is processing
 */
async function handleVerificationProcessing(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    return;
  }

  console.log('[STRIPE WEBHOOK] Processing session:', {
    sessionId: session.id,
    userProfileId,
  });

  // No action needed - just log for monitoring
}

/**
 * Handle canceled verification
 */
async function handleVerificationCanceled(session: Stripe.Identity.VerificationSession) {
  const userProfileId = session.metadata?.user_profile_id;

  if (!userProfileId) {
    return;
  }

  console.log('[STRIPE WEBHOOK] Canceled session:', {
    sessionId: session.id,
    userProfileId,
  });

  // Check if identity link exists and mark as canceled
  const existingLink = await getStripeIdentityLinkBySessionId(session.id);

  if (existingLink) {
    await markStripeIdentityLinkCanceled(existingLink.id, {
      stripe_session_id: session.id,
      status: 'canceled',
      canceled_at: new Date().toISOString(),
    });

    console.log('[STRIPE WEBHOOK] Marked identity link as inactive (canceled)');
  }
}
