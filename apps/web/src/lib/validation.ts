import { NextResponse } from 'next/server';
import { z, ZodType } from 'zod';

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
