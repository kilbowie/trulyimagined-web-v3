import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getStripeIdentityStatus } from '@/lib/stripe/identity';

export async function GET(_request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verificationStatus = await getStripeIdentityStatus(user.sub);
    if (!verificationStatus) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    return NextResponse.json(verificationStatus, { status: 200 });
  } catch (error) {
    console.error('[STRIPE_IDENTITY_STATUS] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to retrieve verification status',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}