import { NextResponse } from 'next/server';
import { z, ZodType } from 'zod';
import { isHdicrHttpError } from '@/lib/hdicr/hdicr-http-client';

/**
 * Standard validation error response shape.
 * All routes must return this shape for 400 errors so clients can handle
 * validation failures predictably.
 */
export interface ValidationErrorResponse {
  success: false;
  error: string;
  details?: z.ZodIssue[];
}

/**
 * Parse and validate a JSON request body against a Zod schema.
 *
 * On success returns `{ ok: true, data }`.
 * On parse error or validation failure returns `{ ok: false, response }` where
 * `response` is a ready-to-return 400 NextResponse with a standardised body.
 *
 * Usage:
 * ```ts
 * const result = await validateBody(request, MySchema);
 * if (!result.ok) return result.response;
 * const { data } = result;
 * ```
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodType<T>
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse<ValidationErrorResponse> }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json<ValidationErrorResponse>(
        { success: false, error: 'Request body must be valid JSON' },
        { status: 400 }
      ),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json<ValidationErrorResponse>(
        {
          success: false,
          error: 'Invalid request payload',
          details: parsed.error.issues,
        },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}

/**
 * Translate an unknown error thrown during a route handler into an appropriate
 * NextResponse.
 *
 * - HdicrHttpError with status 503 or network failure: returns 503 to the caller
 *   so they know an upstream dependency is unavailable (fail-closed, not silent).
 * - HdicrHttpError with other status codes: passes through the HDICR status.
 * - All other errors: returns 500.
 *
 * Usage in a route catch block:
 * ```ts
 * } catch (error) {
 *   console.error('[ROUTE] Operation failed:', error);
 *   return routeErrorResponse(error);
 * }
 * ```
 */
export function routeErrorResponse(error: unknown): NextResponse {
  if (isHdicrHttpError(error)) {
    const statusCode = error.statusCode >= 500 ? error.statusCode : 500;
    return NextResponse.json(
      { success: false, error: 'Upstream service error', message: error.message },
      { status: statusCode }
    );
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json(
    { success: false, error: 'Internal server error', message },
    { status: 500 }
  );
}
