/**
 * GET /api/credentials/status/[listId]
 *
 * Retrieve a W3C BitstringStatusListCredential
 *
 * Standards: W3C Bitstring Status List v1.0
 *
 * This endpoint serves the status list for verifying credential revocation/suspension.
 * Status lists are cached and should be fetched periodically by verifiers.
 *
 * URL Format:
 * - /api/credentials/status/revocation-2024-01
 * - /api/credentials/status/suspension-2024-01
 *
 * Optional Query Parameters:
 * - timestamp: ISO8601 datetime to get status list as of a specific time (optional)
 *
 * Response:
 * - 200 OK: Returns BitstringStatusListCredential (JSON-LD)
 * - 404 Not Found: Status list does not exist
 * - 500 Internal Server Error: Server error
 *
 * Example Response:
 * {
 *   "@context": [
 *     "https://www.w3.org/ns/credentials/v2",
 *     "https://www.w3.org/ns/credentials/status/v1"
 *   ],
 *   "id": "https://trulyimagined.com/api/credentials/status/revocation-2024-01",
 *   "type": ["VerifiableCredential", "BitstringStatusListCredential"],
 *   "issuer": "did:web:trulyimagined.com",
 *   "validFrom": "2024-01-01T00:00:00Z",
 *   "credentialSubject": {
 *     "id": "https://trulyimagined.com/api/credentials/status/revocation-2024-01#list",
 *     "type": "BitstringStatusList",
 *     "statusPurpose": "revocation",
 *     "encodedList": "uH4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA",
 *     "ttl": 3600000
 *   },
 *   "proof": { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getStatusListCredential } from '@/lib/status-list-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: { listId: string } }
) {
  try {
    const listId = params.listId;

    // Optional: Support timestamp query parameter for historical status
    const timestamp = request.nextUrl.searchParams.get('timestamp');
    if (timestamp) {
      // Future enhancement: support historical status lists
      return NextResponse.json(
        {
          success: false,
          error: 'Historical status lists not yet implemented',
        },
        { status: 501 }
      );
    }

    // Retrieve status list credential
    const statusListCredential = await getStatusListCredential(pool, listId);

    if (!statusListCredential) {
      return NextResponse.json(
        {
          success: false,
          error: `Status list '${listId}' not found`,
        },
        { status: 404 }
      );
    }

    // Set caching headers (W3C recommendation: cache status lists)
    const headers = new Headers();
    headers.set('Content-Type', 'application/vc+ld+json');
    headers.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache

    // If status list has TTL, align cache-control with it
    if (statusListCredential.credentialSubject.ttl) {
      const ttlSeconds = Math.floor(statusListCredential.credentialSubject.ttl / 1000);
      headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
    }

    return new NextResponse(JSON.stringify(statusListCredential, null, 2), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Error retrieving status list:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve status list',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
