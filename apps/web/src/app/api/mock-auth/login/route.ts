import { NextRequest, NextResponse } from 'next/server';
import { MOCK_COOKIE_NAME, MOCK_PASSWORD, getMockUserByEmail } from '@/lib/mock-auth';

/**
 * Mock login endpoint — dev only.
 * Validates email against the test user list and sets a session cookie.
 */
export async function POST(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_MOCK_AUTH !== 'true') {
    return NextResponse.json({ error: 'Mock auth is not enabled' }, { status: 403 });
  }

  const body = await req.json();
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  if (password !== MOCK_PASSWORD) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const user = getMockUserByEmail(email.toLowerCase().trim());
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role: user.role });

  response.cookies.set(MOCK_COOKIE_NAME, user.email, {
    httpOnly: false, // readable client-side for AuthNav
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}
