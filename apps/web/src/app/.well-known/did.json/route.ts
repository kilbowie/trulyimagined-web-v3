/**
 * GET /.well-known/did.json
 *
 * Serve platform issuer's W3C DID Document
 *
 * DID: did:web:trulyimagined.com
 * Resolution: https://trulyimagined.com/.well-known/did.json
 *
 * This document contains the platform's public key for verifying
 * credentials issued by Truly Imagined.
 */

import { NextResponse } from 'next/server';
import { generateIssuerDidDocument } from '@/lib/verifiable-credentials';

export async function GET() {
  try {
    const didDocument = await generateIssuerDidDocument();

    return NextResponse.json(didDocument, {
      headers: {
        'Content-Type': 'application/did+json',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Error generating issuer DID document:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate issuer DID document',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
