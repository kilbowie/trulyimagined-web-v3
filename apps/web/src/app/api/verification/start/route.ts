import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { startStripeIdentitySession } from '@/lib/stripe/identity';

// DB-OWNER: HDICR

/**
 * POST /api/verification/start
 * Legacy compatibility route for Stripe identity session creation.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.text();
    const body = rawBody ? (JSON.parse(rawBody) as { provider?: string }) : {};
    if (body.provider && body.provider !== 'stripe') {
      return NextResponse.json(
        {
          error:
            'Legacy non-Stripe verification providers are no longer supported. Use Stripe verification or /api/verification/manual-request.',
          supported: ['stripe'],
        },
        { status: 410 }
      );
    }

    const verificationResult = await startStripeIdentitySession({
      auth0UserId: user.sub,
      email: user.email,
      legalName: user.name,
      professionalName: user.nickname,
    });

    if (!verificationResult) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        ...verificationResult,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[VERIFICATION] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to start verification',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

