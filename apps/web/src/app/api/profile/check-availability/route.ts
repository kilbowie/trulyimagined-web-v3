import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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
      return NextResponse.json({ error: 'Missing type or value parameter' }, { status: 400 });
    }

    // Validate type
    if (!['username', 'professionalName', 'spotlightId'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type. Must be: username, professionalName, or spotlightId' },
        { status: 400 }
      );
    }

    // Query PostgreSQL based on type
    let columnName: string;
    switch (type) {
      case 'username':
        columnName = 'username';
        break;
      case 'professionalName':
        columnName = 'professional_name';
        break;
      case 'spotlightId':
        columnName = 'spotlight_id';
        break;
      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    const result = await query(
      `SELECT EXISTS(SELECT 1 FROM user_profiles WHERE ${columnName} = $1)`,
      [value]
    );

    const available = !result.rows[0].exists;

    console.log(`[CHECK AVAILABILITY] ${type}: ${value} - ${available ? 'available' : 'taken'}`);

    return NextResponse.json({
      type,
      value,
      available,
    });
  } catch (error: unknown) {
    console.error('[CHECK AVAILABILITY] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
