/**
 * Truly Imagined v3 - Bitstring Status List Utilities
 *
 * Standards Compliance:
 * - W3C Bitstring Status List v1.0: https://www.w3.org/TR/vc-bitstring-status-list/
 *
 * Features:
 * - Bitstring encoding/decoding (W3C compliant)
 * - GZIP compression/decompression
 * - Multibase encoding (base64url with no padding)
 * - Status list generation and validation
 *
 * Implementation Notes:
 * - Minimum bitstring size: 131,072 bits (16KB uncompressed)
 * - Bit ordering: index 0 = leftmost bit, index (length-1) = rightmost bit
 * - Status values: 0 = valid/unrevoked, 1 = invalid/revoked
 * - Compression: GZIP (RFC1952) for efficient storage/transmission
 */

import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

// ===========================================
// CONSTANTS
// ===========================================

/** W3C minimum bitstring length: 131,072 bits = 16KB = 16,384 bytes */
export const MIN_BITSTRING_LENGTH = 131072;

/** Default bitstring size (bits) */
export const DEFAULT_BITSTRING_SIZE = MIN_BITSTRING_LENGTH;

/** Multibase prefix for base64url (no padding): 'u' */
export const MULTIBASE_BASE64URL_PREFIX = 'u';

// ===========================================
// TYPES
// ===========================================

export interface BitstringStatusListEntry {
  id: string; // URL to status entry (e.g., "https://example.com/credentials/status/3#94567")
  type: 'BitstringStatusListEntry';
  statusPurpose: 'revocation' | 'suspension' | 'message';
  statusListIndex: string; // Integer as string (e.g., "94567")
  statusListCredential: string; // URL to BitstringStatusListCredential
  statusSize?: number; // Size in bits (default 1)
  statusMessage?: Array<{ status: string; message: string }>; // Optional status messages
  statusReference?: string | string[]; // Optional reference URLs
}

export interface BitstringStatusListCredential {
  '@context': string[];
  id: string; // URL to this status list credential
  type: string[]; // Must include 'BitstringStatusListCredential'
  issuer: string; // DID of issuer
  validFrom: string; // ISO 8601 datetime
  validUntil?: string; // Optional expiration
  credentialSubject: {
    id: string; // URL with #list fragment
    type: 'BitstringStatusList';
    statusPurpose: 'revocation' | 'suspension' | 'message';
    encodedList: string; // Multibase-encoded compressed bitstring
    ttl?: number; // Time-to-live in milliseconds
  };
  proof?: Record<string, unknown>; // Cryptographic proof
}

// ===========================================
// BITSTRING GENERATION
// ===========================================

/**
 * Generate a new bitstring initialized to all zeros
 *
 * @param size - Size in bits (minimum 131,072)
 * @returns Buffer containing the bitstring
 *
 * @example
 * ```typescript
 * const bitstring = generateBitstring(131072);
 * // Returns 16,384 byte buffer filled with zeros
 * ```
 */
export function generateBitstring(size: number = DEFAULT_BITSTRING_SIZE): Buffer {
  if (size < MIN_BITSTRING_LENGTH) {
    throw new Error(`Bitstring size must be at least ${MIN_BITSTRING_LENGTH} bits (got ${size})`);
  }

  if (size % 8 !== 0) {
    throw new Error(`Bitstring size must be a multiple of 8 bits (got ${size})`);
  }

  const byteSize = size / 8;
  return Buffer.alloc(byteSize, 0);
}

// ===========================================
// BITSTRING MANIPULATION
// ===========================================

/**
 * Set a bit at the specified index in a bitstring
 *
 * W3C Standard: Index 0 is the leftmost bit (most significant bit of first byte)
 *
 * @param bitstring - The bitstring buffer
 * @param index - Bit index (0 to bitstring.length * 8 - 1)
 * @param value - Bit value (0 or 1)
 *
 * @example
 * ```typescript
 * const bitstring = generateBitstring(131072);
 * setBit(bitstring, 94567, 1); // Mark credential at index 94567 as revoked
 * ```
 */
export function setBit(bitstring: Buffer, index: number, value: 0 | 1): void {
  const maxIndex = bitstring.length * 8 - 1;

  if (index < 0 || index > maxIndex) {
    throw new RangeError(`Index ${index} out of range (bitstring supports 0-${maxIndex})`);
  }

  if (value !== 0 && value !== 1) {
    throw new Error(`Bit value must be 0 or 1 (got ${value})`);
  }

  // Calculate byte and bit position
  // W3C: index 0 = leftmost bit = bit 7 of byte 0
  const byteIndex = Math.floor(index / 8);
  const bitPosition = 7 - (index % 8); // Left to right: 7, 6, 5, 4, 3, 2, 1, 0

  if (value === 1) {
    // Set bit to 1 (OR with mask)
    bitstring[byteIndex] |= 1 << bitPosition;
  } else {
    // Set bit to 0 (AND with inverted mask)
    bitstring[byteIndex] &= ~(1 << bitPosition);
  }
}

/**
 * Get the value of a bit at the specified index
 *
 * W3C Standard: Index 0 is the leftmost bit (most significant bit of first byte)
 *
 * @param bitstring - The bitstring buffer
 * @param index - Bit index (0 to bitstring.length * 8 - 1)
 * @returns Bit value (0 or 1)
 *
 * @example
 * ```typescript
 * const bitstring = decodeBitstring(encodedList);
 * const status = getBit(bitstring, 94567);
 * console.log(status === 1 ? 'Revoked' : 'Valid');
 * ```
 */
export function getBit(bitstring: Buffer, index: number): 0 | 1 {
  const maxIndex = bitstring.length * 8 - 1;

  if (index < 0 || index > maxIndex) {
    throw new RangeError(`Index ${index} out of range (bitstring supports 0-${maxIndex})`);
  }

  // Calculate byte and bit position
  const byteIndex = Math.floor(index / 8);
  const bitPosition = 7 - (index % 8);

  // Extract bit value
  const bitValue = (bitstring[byteIndex] >> bitPosition) & 1;

  return bitValue as 0 | 1;
}

// ===========================================
// BITSTRING ENCODING/COMPRESSION
// ===========================================

/**
 * Encode a bitstring: GZIP compress and multibase-encode with base64url
 *
 * W3C Algorithm 3.3: Bitstring Generation Algorithm
 * 1. GZIP compress the bitstring (RFC1952)
 * 2. Multibase-encode using base64url (no padding)
 *
 * @param bitstring - Uncompressed bitstring buffer
 * @returns Multibase-encoded compressed bitstring (e.g., "uH4sIAAAAAAAA...")
 *
 * @example
 * ```typescript
 * const bitstring = generateBitstring(131072);
 * setBit(bitstring, 12345, 1);
 * const encodedList = await encodeBitstring(bitstring);
 * // Returns: "uH4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
 * ```
 */
export async function encodeBitstring(bitstring: Buffer): Promise<string> {
  if (bitstring.length < MIN_BITSTRING_LENGTH / 8) {
    throw new Error(
      `Bitstring must be at least ${MIN_BITSTRING_LENGTH / 8} bytes ` +
        `(got ${bitstring.length} bytes)`
    );
  }

  // 1. GZIP compress
  const compressed = await gzipAsync(bitstring);

  // 2. Base64url encode (no padding) and add multibase prefix 'u'
  const base64urlEncoded = compressed
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return MULTIBASE_BASE64URL_PREFIX + base64urlEncoded;
}

/**
 * Decode a bitstring: multibase-decode and GZIP decompress
 *
 * W3C Algorithm 3.4: Bitstring Expansion Algorithm
 * 1. Multibase-decode from base64url
 * 2. GZIP decompress (RFC1952)
 *
 * @param encodedList - Multibase-encoded compressed bitstring
 * @returns Uncompressed bitstring buffer
 *
 * @example
 * ```typescript
 * const encodedList = "uH4sIAAAAAAAAA-3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA";
 * const bitstring = await decodeBitstring(encodedList);
 * const status = getBit(bitstring, 12345);
 * ```
 */
export async function decodeBitstring(encodedList: string): Promise<Buffer> {
  if (!encodedList || typeof encodedList !== 'string') {
    throw new Error('Invalid encodedList: must be a non-empty string');
  }

  // Validate multibase prefix (should start with 'u' for base64url)
  if (!encodedList.startsWith(MULTIBASE_BASE64URL_PREFIX)) {
    throw new Error(
      `Invalid multibase encoding: expected prefix '${MULTIBASE_BASE64URL_PREFIX}' ` +
        `(got '${encodedList[0]}')`
    );
  }

  try {
    // 1. Remove multibase prefix and decode from base64url
    const base64urlEncoded = encodedList.slice(1);
    const base64Standard = base64urlEncoded.replace(/-/g, '+').replace(/_/g, '/');

    // Add padding if needed
    const paddingLength = (4 - (base64Standard.length % 4)) % 4;
    const paddedBase64 = base64Standard + '='.repeat(paddingLength);

    const compressed = Buffer.from(paddedBase64, 'base64');

    // 2. GZIP decompress
    const decompressed = await gunzipAsync(compressed);

    // Validate minimum size
    if (decompressed.length < MIN_BITSTRING_LENGTH / 8) {
      throw new Error(
        `Decompressed bitstring is too small: ${decompressed.length} bytes ` +
          `(minimum ${MIN_BITSTRING_LENGTH / 8} bytes)`
      );
    }

    return decompressed;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid')) {
      throw error;
    }
    throw new Error(`Failed to decode bitstring: ${(error as Error).message}`);
  }
}

// ===========================================
// STATUS LIST HELPERS
// ===========================================

/**
 * Check if a credential is revoked based on its status list entry
 *
 * W3C Algorithm 3.2: Validate Algorithm (simplified)
 *
 * @param encodedList - Multibase-encoded compressed bitstring
 * @param statusListIndex - Index in the status list
 * @param statusSize - Size of status entry in bits (default 1)
 * @returns Status value (0 = valid, 1 = revoked for statusSize=1)
 *
 * @example
 * ```typescript
 * const isRevoked = await checkCredentialStatus(
 *   encodedList,
 *   "94567",
 *   1
 * );
 * console.log(isRevoked === 1 ? 'Credential is revoked' : 'Credential is valid');
 * ```
 */
export async function checkCredentialStatus(
  encodedList: string,
  statusListIndex: string,
  statusSize: number = 1
): Promise<number> {
  const bitstring = await decodeBitstring(encodedList);
  const index = parseInt(statusListIndex, 10);

  if (isNaN(index) || index < 0) {
    throw new Error(`Invalid statusListIndex: ${statusListIndex}`);
  }

  if (statusSize !== 1) {
    throw new Error('Multi-bit status entries not yet implemented (statusSize must be 1)');
  }

  return getBit(bitstring, index);
}

/**
 * Get a random available index for privacy-preserving allocation
 *
 * W3C Privacy Consideration: Random allocation prevents correlation attacks
 *
 * @param _currentIndex - Current highest allocated index (unused, kept for API compatibility)
 * @param maxIndex - Maximum index (bitstring size - 1)
 * @param allocatedIndices - Set of already allocated indices
 * @returns Random available index
 *
 * @example
 * ```typescript
 * const index = getRandomIndex(1000, 131071, new Set([500, 750]));
 * // Returns random index between 0 and 131071, excluding already allocated indices
 * ```
 */
export function getRandomIndex(
  _currentIndex: number,
  maxIndex: number,
  allocatedIndices: Set<number>
): number {
  const availableIndices: number[] = [];

  for (let i = 0; i <= maxIndex; i++) {
    if (!allocatedIndices.has(i)) {
      availableIndices.push(i);
    }
  }

  if (availableIndices.length === 0) {
    throw new Error('No available indices in status list');
  }

  // Random selection for privacy (W3C recommendation)
  const randomIdx = Math.floor(Math.random() * availableIndices.length);
  return availableIndices[randomIdx];
}
