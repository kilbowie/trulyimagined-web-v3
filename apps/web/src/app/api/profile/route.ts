import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';

// In production, this would connect to PostgreSQL via API
// For now, mock implementation that simulates database calls

/**
 * Get user profile
 * 
 * GET /api/profile
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // TODO: In production, query PostgreSQL user_profiles table
    // const profile = await db.query(queries.userProfiles.getByAuth0Id, [user.sub]);
    
    // For now, return mock data to unblock development
    return NextResponse.json({
      profile: null, // Will be null for new users
      needsSetup: true,
    });
  } catch (error: unknown) {
    console.error('[PROFILE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Create or update user profile
 * 
 * POST /api/profile
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      role,
      username,
      legalName,
      professionalName,
      useLegalAsProfessional,
      spotlightId,
    } = body;

    // Validation
    if (!role || !username || !legalName) {
      return NextResponse.json(
        { error: 'Missing required fields: role, username, legalName' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['Actor', 'Agent', 'Enterprise', 'Admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: Actor, Agent, Enterprise, or Admin' },
        { status: 400}
      );
    }

    // Validate username format
    if (!/^[a-zA-Z0-9_-]{3,50}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3-50 characters (letters, numbers, _, -)' },
        { status: 400 }
      );
    }

    // Validate Spotlight ID format (if provided)
    if (spotlightId && !spotlightId.match(/^https?:\/\//)) {
      return NextResponse.json(
        { error: 'Spotlight ID must be a valid URL (http:// or https://)' },
        { status: 400 }
      );
    }

    // Determine professional name
    const finalProfessionalName = useLegalAsProfessional 
      ? legalName 
      : (professionalName || legalName);

    // TODO: In production, insert into PostgreSQL
    // First check if username/professional name already exist
    // const usernameCheck = await db.query(queries.userProfiles.checkUsernameAvailable, [username]);
    // if (usernameCheck.rows[0].exists) {
    //   return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    // }
    
    // const profNameCheck = await db.query(queries.userProfiles.checkProfessionalNameAvailable, [finalProfessionalName]);
    // if (profNameCheck.rows[0].exists) {
    //   return NextResponse.json({ error: 'Professional name already taken' }, { status: 409 });
    // }

    // If Spotlight ID provided, check it's unique
    // if (spotlightId) {
    //   const spotlightCheck = await db.query(queries.userProfiles.checkSpotlightIdAvailable, [spotlightId]);
    //   if (spotlightCheck.rows[0].exists) {
    //     return NextResponse.json({ error: 'Spotlight ID already registered' }, { status: 409 });
    //   }
    // }

    // Create profile
    // const result = await db.query(queries.userProfiles.create, [
    //   user.sub, // auth0_user_id
    //   user.email, // email
    //   role,
    //   username,
    //   legalName,
    //   finalProfessionalName,
    //   useLegalAsProfessional || false,
    //   spotlightId || null,
    //   true, // profile_completed
    // ]);

    console.log('[PROFILE] Created profile:', {
      auth0UserId: user.sub,
      email: user.email,
      role,
      username,
      legalName,
      professionalName: finalProfessionalName,
      useLegalAsProfessional,
      spotlightId,
    });

    // Mock response for development
    return NextResponse.json({
      success: true,
      profile: {
        id: `mock-${Date.now()}`,
        auth0UserId: user.sub,
        email: user.email,
        role,
        username,
        legalName,
        professionalName: finalProfessionalName,
        useLegalAsProfessional: useLegalAsProfessional || false,
        spotlightId: spotlightId || null,
        profileCompleted: true,
        createdAt: new Date().toISOString(),
      },
      message: 'Profile created successfully (development mode)',
    });
  } catch (error: unknown) {
    console.error('[PROFILE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
