import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { query } from '@/lib/db';

/**
 * POST /api/verification/start
 * Initiates identity verification with a KYC provider
 * 
 * Step 7: Multi-Provider Identity Linking
 * Supports: Onfido, Yoti, or mock verification for development
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
      provider = 'mock', // 'onfido', 'yoti', 'mock'
      verificationType: _verificationType = 'identity', // 'identity', 'document', 'liveness'
      documents = ['passport'], // Document types for verification
    } = body;

    // Get user profile
    const userResult = await query(
      `SELECT id, email, first_name, last_name FROM user_profiles WHERE auth0_user_id = $1`,
      [session.user.sub]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const userProfile = userResult.rows[0];

    // Handle different providers
    let verificationResult;

    switch (provider) {
      case 'onfido':
        verificationResult = await startOnfidoVerification(userProfile, documents);
        break;
      
      case 'yoti':
        verificationResult = await startYotiVerification(userProfile);
        break;
      
      case 'mock':
        verificationResult = await startMockVerification(userProfile);
        break;
      
      default:
        return NextResponse.json(
          {
            error: 'Unsupported verification provider',
            supported: ['onfido', 'yoti', 'mock'],
          },
          { status: 400 }
        );
    }

    console.log('[VERIFICATION] Started verification:', {
      userId: userProfile.id,
      provider,
      verificationId: verificationResult.verificationId,
    });

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

/**
 * Start Onfido verification
 * TODO: Implement when Onfido credentials are available
 */
async function startOnfidoVerification(
  _userProfile: Record<string, unknown>,
  _documents: string[]
) {
  const onfidoApiToken = process.env.ONFIDO_API_TOKEN;

  if (!onfidoApiToken) {
    throw new Error('Onfido API token not configured. Set ONFIDO_API_TOKEN environment variable.');
  }

  // TODO: Implement actual Onfido integration
  // For now, return mock response indicating it's not yet implemented
  return {
    provider: 'onfido',
    verificationId: `onfido-${Date.now()}`,
    status: 'pending',
    sdkToken: null,
    message: 'Onfido integration pending - API credentials required',
    nextSteps: [
      'Install onfido-node package',
      'Configure ONFIDO_API_TOKEN',
      'Set up webhook endpoint',
    ],
  };
}

/**
 * Start Yoti verification
 * TODO: Implement when Yoti credentials are available
 */
async function startYotiVerification(_userProfile: Record<string, unknown>) {
  const yotiClientSdkId = process.env.YOTI_CLIENT_SDK_ID;

  if (!yotiClientSdkId) {
    throw new Error('Yoti SDK ID not configured. Set YOTI_CLIENT_SDK_ID environment variable.');
  }

  return {
    provider: 'yoti',
    verificationId: `yoti-${Date.now()}`,
    status: 'pending',
    sessionId: null,
    message: 'Yoti integration pending - API credentials required',
  };
}

/**
 * Start mock verification for development/testing
 * Automatically creates a high-assurance identity link
 */
async function startMockVerification(userProfile: Record<string, unknown>) {
  const verificationId = `mock-${Date.now()}`;
  const userId = userProfile.id as string;

  // Create mock identity link with high verification level
  const linkResult = await query(
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
      last_verified_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
    RETURNING id`,
    [
      userId,
      'mock-kyc',
      verificationId,
      'kyc',
      'high',
      'high',
      JSON.stringify({
        firstName: userProfile.first_name,
        lastName: userProfile.last_name,
        email: userProfile.email,
        documentType: 'passport',
        documentNumber: 'MOCK1234567',
        documentVerified: true,
        livenessCheck: true,
        verifiedAt: new Date().toISOString(),
      }),
      JSON.stringify({
        provider: 'Mock KYC Provider',
        environment: 'development',
        note: 'This is a mock verification for development/testing purposes',
      }),
    ]
  );

  const linkId = linkResult.rows[0].id;

  console.log('[VERIFICATION] Created mock verification link:', {
    userId,
    linkId,
    verificationId,
  });

  return {
    provider: 'mock',
    verificationId,
    linkId,
    status: 'complete',
    verificationLevel: 'high',
    assuranceLevel: 'high',
    result: {
      documentVerified: true,
      livenessCheck: true,
      nameMatch: true,
      dobMatch: true,
    },
    message: 'Mock verification completed successfully (development mode)',
  };
}
