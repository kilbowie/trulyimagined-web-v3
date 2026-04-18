import { NextRequest, NextResponse } from 'next/server';
import { MOCK_COOKIE_NAME, getMockUserByEmail } from '@/lib/mock-auth';

/**
 * Returns the current mock session user — used by client components
 * (e.g. AuthNav) to read the mock auth state without calling Auth0.
 */
export async function GET(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_MOCK_AUTH !== 'true') {
    return NextResponse.json(null);
  }

  const email = req.cookies.get(MOCK_COOKIE_NAME)?.value;
  if (!email) return NextResponse.json(null);

  const user = getMockUserByEmail(email);
  if (!user) return NextResponse.json(null);

  return NextResponse.json(user);
}
