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

      // Show appropriate success message
      const message = responseData.legacy
        ? '✅ Legacy credential revoked successfully!\n\nNote: This credential was created before W3C Status List implementation, so revocation is recorded in the database only.'
        : '✅ Credential revoked successfully!\n\nThe W3C Bitstring Status List has been updated.';

      alert(message);
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
      <div className="container mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-2/3 rounded bg-muted md:w-1/3"></div>
            <div className="h-4 w-4/5 rounded bg-muted md:w-1/2"></div>
            <div className="h-64 rounded bg-muted"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-6xl px-4 py-6 md:py-8">
        <div className="rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h1 className="mb-4 text-2xl font-bold text-foreground">Error Loading Credential</h1>
            <p className="mb-6 text-sm text-destructive md:text-base">
              {error || 'Credential not found'}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
    <div className="container mx-auto max-w-6xl px-4 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="mb-4 inline-block text-sm font-medium text-primary transition-colors hover:text-primary/80 md:text-base"
        >
          ← Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Credential Details</h1>
      </div>

      {/* Status Banner */}
      <div
        className={`mb-6 rounded-xl border p-4 md:p-5 ${
          isActive
            ? 'border-emerald-500/30 bg-emerald-500/10'
            : metadata.isRevoked
              ? 'border-destructive/40 bg-destructive/10'
              : 'border-amber-500/30 bg-amber-500/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="text-3xl">{isActive ? '✅' : metadata.isRevoked ? '🚫' : '⚠️'}</span>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {isActive ? 'Active Credential' : metadata.isRevoked ? 'Revoked' : 'Expired'}
            </h2>
            <p className="text-sm text-muted-foreground">
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
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
        <button
          onClick={downloadCredential}
          className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:w-auto"
        >
          📥 Download JSON
        </button>
        <button
          onClick={verifyCredential}
          disabled={verifying}
          className="w-full rounded-lg bg-secondary px-4 py-2 font-medium text-secondary-foreground transition-colors hover:bg-secondary/85 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
        >
          {verifying ? '⏳ Verifying...' : '🔍 Verify Signature'}
        </button>
        {!metadata.isRevoked && (
          <button
            onClick={revokeCredential}
            disabled={revoking}
            className="w-full rounded-lg bg-destructive px-4 py-2 font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2 lg:w-auto"
          >
            {revoking ? '⏳ Revoking...' : '🚫 Revoke Credential'}
          </button>
        )}
      </div>

      {/* Verification Result */}
      {verification && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            verification.verified
              ? 'border-emerald-500/30 bg-emerald-500/10'
              : 'border-destructive/40 bg-destructive/10'
          }`}
        >
          <h3 className="mb-1 font-semibold text-foreground">
            {verification.verified ? '✅ Signature Valid' : '❌ Signature Invalid'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {verification.verified
              ? 'Cryptographic signature verified successfully'
              : `Verification failed: ${verification.error}`}
          </p>
        </div>
      )}

      {/* Metadata Card */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-foreground">Metadata</h2>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Credential Type</dt>
            <dd className="mt-1 text-sm text-foreground">
              {metadata.credentialType.replace('Credential', ' Credential')}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Database ID</dt>
            <dd className="mt-1 break-all font-mono text-sm text-foreground">{metadata.id}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Issued At</dt>
            <dd className="mt-1 text-sm text-foreground">
              {new Date(metadata.issuedAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Expires At</dt>
            <dd className="mt-1 text-sm text-foreground">
              {metadata.expiresAt ? new Date(metadata.expiresAt).toLocaleString() : 'Never'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Proof Type</dt>
            <dd className="mt-1 text-sm text-foreground">{metadata.proofType}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Verification Method</dt>
            <dd className="mt-1 break-all font-mono text-sm text-foreground">
              {metadata.verificationMethod}
            </dd>
          </div>
        </dl>
      </div>

      {/* W3C Bitstring Status List */}
      {credential.credentialStatus && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5 md:p-6">
          <h2 className="mb-4 text-xl font-bold text-foreground">W3C Bitstring Status List</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            This credential includes revocation status information compliant with{' '}
            <a
              href="https://www.w3.org/TR/vc-bitstring-status-list/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              W3C Bitstring Status List v1.0
            </a>
          </p>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status Purpose</dt>
              <dd className="mt-1 text-sm capitalize text-foreground">
                {credential.credentialStatus.statusPurpose}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status List Index</dt>
              <dd className="mt-1 font-mono text-sm text-foreground">
                {credential.credentialStatus.statusListIndex}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status List Credential</dt>
              <dd className="mt-1 text-sm">
                <a
                  href={credential.credentialStatus.statusListCredential}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-mono text-primary hover:underline"
                >
                  {credential.credentialStatus.statusListCredential}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Status Entry ID</dt>
              <dd className="mt-1 text-sm">
                <a
                  href={credential.credentialStatus.id}
                  className="break-all font-mono text-primary hover:underline"
                >
                  {credential.credentialStatus.id}
                </a>
              </dd>
            </div>
          </dl>
        </div>
      )}

      {!credential.credentialStatus && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 md:p-6">
          <h2 className="mb-2 text-xl font-bold text-foreground">
            ⚠️ Legacy Credential (No Status List)
          </h2>
          <p className="text-sm text-muted-foreground">
            This credential was issued before the W3C Bitstring Status List implementation was
            added. It does not include verifiable revocation status information, but can still be
            revoked in the database. Revocation status will only be reflected in our system and not
            verifiable by external parties through a status list.
          </p>
        </div>
      )}

      {/* DID Information */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-foreground">Decentralized Identifiers (DIDs)</h2>
        <dl className="space-y-3">
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Credential ID (W3C VC ID)</dt>
            <dd className="mt-1 text-sm">
              <a href={credential.id} className="break-all font-mono text-primary hover:underline">
                {credential.id}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Holder DID</dt>
            <dd className="mt-1 text-sm">
              <span className="break-all font-mono text-foreground">{metadata.holderDid}</span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-muted-foreground">Issuer DID</dt>
            <dd className="mt-1 text-sm">
              <a
                href={credential.issuer}
                className="break-all font-mono text-primary hover:underline"
              >
                {credential.issuer}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      {/* Full Credential JSON */}
      <div className="rounded-xl border border-border bg-card p-5 md:p-6">
        <h2 className="mb-4 text-xl font-bold text-foreground">Full Credential (JSON-LD)</h2>
        <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-4 text-xs text-foreground">
          <code>{JSON.stringify(credential, null, 2)}</code>
        </pre>
      </div>
    </div>
  );
}
