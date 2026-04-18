import { NextRequest, NextResponse } from 'next/server';
import { MOCK_COOKIE_NAME } from '@/lib/mock-auth';

export async function POST(_req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(MOCK_COOKIE_NAME);
  return response;
}
