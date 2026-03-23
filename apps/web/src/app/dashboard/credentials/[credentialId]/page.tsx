/**
 * Credential Detail Page
 *
 * Display full details of a W3C Verifiable Credential including:
 * - Full credential JSON with syntax highlighting
 * - Metadata (issued, expires, status)
 * - W3C Bitstring Status List information
 * - DID Document links
 * - Actions (download, revoke)
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  validFrom: string;
  validUntil?: string;
  credentialSubject: Record<string, unknown>;
  credentialStatus?: {
    id: string;
    type: string;
    statusPurpose: string;
    statusListIndex: string;
    statusListCredential: string;
  };
  proof?: Record<string, unknown>;
}

interface CredentialMetadata {
  id: string;
  credentialType: string;
  issuedAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  holderDid: string;
  issuerDid: string;
  verificationMethod: string;
  proofType: string;
}

interface CredentialResponse {
  success: boolean;
  credential: VerifiableCredential;
  metadata: CredentialMetadata;
  verification?: {
    verified: boolean;
    error?: unknown;
  };
}

export default function CredentialDetailPage() {
  const params = useParams();
  const credentialId = params.credentialId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CredentialResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    fetchCredential();
  }, [credentialId]);

  async function fetchCredential() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/credentials/${credentialId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch credential');
      }

      const credentialData = await response.json();
      setData(credentialData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCredential() {
    try {
      setVerifying(true);
      setError(null);
      const response = await fetch(`/api/credentials/${credentialId}?verify=true`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to verify credential');
      }

      const credentialData = await response.json();
      setData(credentialData);
      alert(
        credentialData.verification?.verified
          ? '✅ Credential signature is valid!'
          : '❌ Credential verification failed!'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      alert('❌ ' + (err instanceof Error ? err.message : 'Verification failed'));
    } finally {
      setVerifying(false);
    }
  }

  async function downloadCredential() {
    try {
      const response = await fetch(`/api/credentials/${credentialId}?download=true`);
      if (!response.ok) {
        throw new Error('Failed to download credential');
      }

      const credential = await response.json();
      const blob = new Blob([JSON.stringify(credential, null, 2)], {
        type: 'application/ld+json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credential-${credentialId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  async function revokeCredential() {
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to revoke this credential?\n\n' +
        'This action cannot be undone. The credential will be permanently marked as revoked ' +
        'in the W3C Bitstring Status List and will fail verification checks.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setRevoking(true);
      setError(null);

      const response = await fetch('/api/credentials/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          reason: 'Revoked by credential holder',
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to revoke credential');
      }

      alert('✅ Credential revoked successfully!');
      await fetchCredential(); // Refresh to show revoked status
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke credential');
      alert('❌ ' + (err instanceof Error ? err.message : 'Failed to revoke credential'));
    } finally {
      setRevoking(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Credential</h1>
            <p className="text-red-600 mb-6">{error || 'Credential not found'}</p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { credential, metadata, verification } = data;
  const isExpired = metadata.expiresAt && new Date(metadata.expiresAt) < new Date();
  const isActive = !metadata.isRevoked && !isExpired;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-purple-600 hover:text-purple-700 font-medium mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">Credential Details</h1>
      </div>

      {/* Status Banner */}
      <div
        className={`mb-6 p-4 rounded-lg border-2 ${
          isActive
            ? 'bg-green-50 border-green-200'
            : metadata.isRevoked
            ? 'bg-red-50 border-red-200'
            : 'bg-orange-50 border-orange-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">
            {isActive ? '✅' : metadata.isRevoked ? '🚫' : '⚠️'}
          </span>
          <div>
            <h2 className="font-bold text-lg">
              {isActive ? 'Active Credential' : metadata.isRevoked ? 'Revoked' : 'Expired'}
            </h2>
            <p className="text-sm text-gray-700">
              {isActive
                ? 'This credential is valid and can be used for verification'
                : metadata.isRevoked
                ? `Revoked on ${new Date(metadata.revokedAt!).toLocaleString()}${
                    metadata.revocationReason ? `: ${metadata.revocationReason}` : ''
                  }`
                : `Expired on ${new Date(metadata.expiresAt!).toLocaleString()}`}
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={downloadCredential}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          📥 Download JSON
        </button>
        <button
          onClick={verifyCredential}
          disabled={verifying}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          {verifying ? '⏳ Verifying...' : '🔍 Verify Signature'}
        </button>
        {!metadata.isRevoked && (
          <button
            onClick={revokeCredential}
            disabled={revoking}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {revoking ? '⏳ Revoking...' : '🚫 Revoke Credential'}
          </button>
        )}
      </div>

      {/* Verification Result */}
      {verification && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            verification.verified
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <h3 className="font-semibold mb-1">
            {verification.verified ? '✅ Signature Valid' : '❌ Signature Invalid'}
          </h3>
          <p className="text-sm text-gray-700">
            {verification.verified
              ? 'Cryptographic signature verified successfully'
              : `Verification failed: ${verification.error}`}
          </p>
        </div>
      )}

      {/* Metadata Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Metadata</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Credential Type</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {metadata.credentialType.replace('Credential', ' Credential')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Database ID</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono break-all">{metadata.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Issued At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(metadata.issuedAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Expires At</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {metadata.expiresAt ? new Date(metadata.expiresAt).toLocaleString() : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Proof Type</dt>
            <dd className="mt-1 text-sm text-gray-900">{metadata.proofType}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Verification Method</dt>
            <dd className="mt-1 text-sm text-gray-900 font-mono break-all">
              {metadata.verificationMethod}
            </dd>
          </div>
        </dl>
      </div>

      {/* W3C Bitstring Status List */}
      {credential.credentialStatus && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">W3C Bitstring Status List</h2>
          <p className="text-sm text-gray-600 mb-4">
            This credential includes revocation status information compliant with{' '}
            <a
              href="https://www.w3.org/TR/vc-bitstring-status-list/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 hover:underline"
            >
              W3C Bitstring Status List v1.0
            </a>
          </p>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Status Purpose</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">
                {credential.credentialStatus.statusPurpose}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status List Index</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {credential.credentialStatus.statusListIndex}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status List Credential</dt>
              <dd className="mt-1 text-sm">
                <a
                  href={credential.credentialStatus.statusListCredential}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:underline font-mono break-all"
                >
                  {credential.credentialStatus.statusListCredential}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status Entry ID</dt>
              <dd className="mt-1 text-sm">
                <a
                  href={credential.credentialStatus.id}
                  className="text-purple-600 hover:underline font-mono break-all"
                >
                  {credential.credentialStatus.id}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {/* DID Information */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Decentralized Identifiers (DIDs)</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">Credential ID (W3C VC ID)</dt>
            <dd className="mt-1 text-sm">
              <a
                href={credential.id}
                className="text-purple-600 hover:underline font-mono break-all"
              >
                {credential.id}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Holder DID</dt>
            <dd className="mt-1 text-sm">
              <span className="font-mono break-all text-gray-900">{metadata.holderDid}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Issuer DID</dt>
            <dd className="mt-1 text-sm">
              <a
                href={credential.issuer}
                className="text-purple-600 hover:underline font-mono break-all"
              >
                {credential.issuer}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      {/* Full Credential JSON */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Full Credential (JSON-LD)</h2>
        <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-xs">
          <code>{JSON.stringify(credential, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}
