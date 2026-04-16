import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { startStripeIdentitySession } from '@/lib/stripe/identity';

export async function POST(_request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    console.error('[STRIPE_IDENTITY_SESSION] Error:', error);
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