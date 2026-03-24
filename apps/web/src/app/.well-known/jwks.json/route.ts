import { NextResponse } from 'next/server';
import { getConsentSigningJWKS } from '@/lib/consent-proof';

/**
 * GET /.well-known/jwks.json
 *
 * JSON Web Key Set (JWKS) endpoint for consent proof verification.
 * External consumers can use this endpoint to retrieve the public key
 * for verifying JWT consent proofs.
 *
 * Standards: RFC 7517 (JSON Web Key)
 *
 * Usage by external consumers:
 * 1. Fetch this endpoint to get public keys
 * 2. Use the public key to verify JWT proofs from /api/consent/check
 * 3. Verify the issuer is 'did:web:trulyimagined.com'
 *
 * Example with jwks-rsa library:
 * ```
 * const jwksClient = require('jwks-rsa');
 * const client = jwksClient({
 *   jwksUri: 'https://trulyimagined.com/.well-known/jwks.json',
 *   cache: true
 * });
 * ```
 */
export async function GET() {
  try {
    const jwks = getConsentSigningJWKS();

    return NextResponse.json(jwks, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Access-Control-Allow-Origin': '*', // Allow cross-origin access
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error: any) {
    console.error('[JWKS] Error generating JWKS:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate JWKS',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
