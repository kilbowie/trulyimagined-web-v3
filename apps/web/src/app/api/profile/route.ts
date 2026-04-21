import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getUserProfile } from '@/lib/auth';
import { query } from '@/lib/db';

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getUserProfile();

    return NextResponse.json({
      profile,
      needsSetup: !profile,
    });
  } catch (error: unknown) {
    console.error('[PROFILE] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { role, username, legalName, professionalName, useLegalAsProfessional, spotlightId } =
      body;

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
        { status: 400 }
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
      : professionalName || legalName;

    // Check if username already exists
    const usernameCheck = await query(
      'SELECT EXISTS(SELECT 1 FROM user_profiles WHERE username = $1)',
      [username]
    );
    if (usernameCheck.rows[0].exists) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    // Check if professional name already exists
    const profNameCheck = await query(
      'SELECT EXISTS(SELECT 1 FROM user_profiles WHERE professional_name = $1)',
      [finalProfessionalName]
    );
    if (profNameCheck.rows[0].exists) {
      return NextResponse.json({ error: 'Professional name already taken' }, { status: 409 });
    }

    // If Spotlight ID provided, check it's unique
    if (spotlightId) {
      const spotlightCheck = await query(
        'SELECT EXISTS(SELECT 1 FROM user_profiles WHERE spotlight_id = $1)',
        [spotlightId]
      );
      if (spotlightCheck.rows[0].exists) {
        return NextResponse.json({ error: 'Spotlight ID already registered' }, { status: 409 });
      }
    }

    // Create profile
    const result = await query(
      `INSERT INTO user_profiles (
        auth0_user_id, email, role, username, legal_name, 
        professional_name, use_legal_as_professional, spotlight_id, profile_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        user.sub,
        user.email,
        role,
        username,
        legalName,
        finalProfessionalName,
        useLegalAsProfessional || false,
        spotlightId || null,
        true,
      ]
    );

    console.log('[PROFILE] Created profile successfully');

    return NextResponse.json({
      success: true,
      profile: result.rows[0],
      message: 'Profile created successfully',
    });
  } catch (error: unknown) {
    console.error('[PROFILE] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
