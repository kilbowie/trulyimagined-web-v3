import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/consent/check?actorId={id}&consentType={type}&projectId={id}
 * Checks if consent is currently active
 *
 * Query params:
 * - actorId: string (required)
 * - consentType: string (required)
 * - projectId: string (optional)
 *
 * Returns:
 * {
 *   isGranted: boolean
 *   consent: { ... } | null
 *   latestAction: { action, timestamp, reason }
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const actorId = searchParams.get('actorId');
    const consentType = searchParams.get('consentType');
    const projectId = searchParams.get('projectId');

    // Validation
    if (!actorId || !consentType) {
      return NextResponse.json(
        { error: 'Missing required parameters: actorId, consentType' },
        { status: 400 }
      );
    }

    // Build query string
    const queryParams = new URLSearchParams({
      actorId,
      consentType,
      ...(projectId && { projectId }),
    });

    // Call Lambda consent service
    const lambdaUrl = process.env.CONSENT_SERVICE_URL || 'http://localhost:3001';
    const url = `${lambdaUrl}/consent/check?${queryParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    console.error('[API] Check consent error:', error);
    const err = error as Error;
    return NextResponse.json(
      { error: 'Internal server error', message: err.message },
      { status: 500 }
    );
  }
}
