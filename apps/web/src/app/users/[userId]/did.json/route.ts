/**
 * GET /users/[userId]/did.json
 *
 * Serve W3C DID Document for a user
 *
 * DID Method: did:web
 * Format: did:web:trulyimagined.com:users:{userId}
 * Resolution: https://trulyimagined.com/users/{userId}/did.json
 *
 * Returns:
 * {
 *   "@context": ["https://www.w3.org/ns/did/v1", ...],
 *   "id": "did:web:trulyimagined.com:users:{userId}",
 *   "verificationMethod": [...],
 *   "authentication": [...],
 *   ...
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { generateDidDocument } from '@/lib/verifiable-credentials';

// ===========================================
// GET /users/[userId]/did.json
// ===========================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return NextResponse.json({ error: 'Invalid user ID format' }, { status: 400 });
    }

    // Check if user exists
    const userResult = await pool.query(
      `SELECT id, username, professional_name
       FROM user_profiles
       WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = userResult.rows[0];

    // Generate DID document for user
    const didDocument = await generateDidDocument(userId);

    // Add optional service endpoints
    didDocument.service = [
      {
        id: `${didDocument.id}#profile`,
        type: 'LinkedDomains',
        serviceEndpoint: `https://trulyimagined.com/profile/${user.username}`,
      },
      {
        id: `${didDocument.id}#credentials`,
        type: 'CredentialHolder',
        serviceEndpoint: `https://trulyimagined.com/api/credentials?holder=${userId}`,
      },
    ];

    // Add user metadata (public info only)
    didDocument.name = user.professional_name;
    didDocument.description = `Truly Imagined user profile for ${user.professional_name}`;

    // Return DID document with proper headers
    return NextResponse.json(didDocument, {
      headers: {
        'Content-Type': 'application/did+json',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating DID document:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate DID document',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
