import { NextRequest, NextResponse } from 'next/server';

/**
 * Check username/professional name/spotlight ID availability
 * 
 * GET /api/profile/check-availability?type={username|professionalName|spotlightId}&value={value}
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const value = searchParams.get('value');

    if (!type || !value) {
      return NextResponse.json(
        { error: 'Missing type or value parameter' },
        { status: 400 }
      );
    }

    // Validate type
    if (!['username', 'professionalName', 'spotlightId'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: username, professionalName, or spotlightId' },
        { status: 400 }
      );
    }

    // TODO: In production, query PostgreSQL
    // switch (type) {
    //   case 'username':
    //     const usernameCheck = await db.query(queries.userProfiles.checkUsernameAvailable, [value]);
    //     return NextResponse.json({ available: !usernameCheck.rows[0].exists });
    //   case 'professionalName':
    //     const profNameCheck = await db.query(queries.userProfiles.checkProfessionalNameAvailable, [value]);
    //     return NextResponse.json({ available: !profNameCheck.rows[0].exists });
    //   case 'spotlightId':
    //     const spotlightCheck = await db.query(queries.userProfiles.checkSpotlightIdAvailable, [value]);
    //     return NextResponse.json({ available: !spotlightCheck.rows[0].exists });
    // }

    // Mock response for development - always available
    console.log(`[CHECK AVAILABILITY] ${type}: ${value}`);
    
    return NextResponse.json({
      type,
      value,
      available: true,
      message: 'Development mode: always returns available',
    });
  } catch (error: unknown) {
    console.error('[CHECK AVAILABILITY] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
