/**
 * Verifiable Credentials Component
 *
 * Displays user's W3C Verifiable Credentials and provides:
 * - List of issued credentials
 * - Download credential as JSON
 * - Request new credential
 * - View credential details
 * - Revoke credential
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface VerifiableCredential {
  '@context': string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: Record<string, unknown>;
  proof?: Record<string, unknown>;
}

interface CredentialMetadata {
  id: string;
  credentialType: string;
  issuedAt: string;
  expiresAt: string | null;
  isRevoked: boolean;
  revokedAt: string | null;
  holderDid: string;
}

interface CredentialData {
  credential: VerifiableCredential;
  metadata: CredentialMetadata;
}

export function VerifiableCredentialsCard() {
  const [credentials, setCredentials] = useState<CredentialData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null); // credentialId being revoked

  // Fetch user's credentials
  useEffect(() => {
    fetchCredentials();
  }, []);

  async function fetchCredentials() {
    try {
      setLoading(true);
      const response = await fetch('/api/credentials/list');
      if (!response.ok) {
        throw new Error('Failed to fetch credentials');
      }
      const data = await response.json();
      setCredentials(data.credentials || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function issueNewCredential() {
    try {
      setIssuing(true);
      setError(null);

      const response = await fetch('/api/credentials/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresInDays: 365, // 1 year expiration
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to issue credential');
      }

      await response.json();

      // Refresh credentials list
      await fetchCredentials();

      alert('✅ Credential issued successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue credential');
    } finally {
      setIssuing(false);
    }
  }

  async function downloadCredential(credentialId: string) {
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
      alert(
        'Failed to download credential: ' + (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  }

  async function revokeCredential(credentialId: string) {
    // Confirmation dialog
    const confirmed = window.confirm(
      '⚠️ Are you sure you want to revoke this credential?\n\n' +
        'This action cannot be undone. The credential will be permanently marked as revoked ' +
        'in the W3C Bitstring Status List and will fail verification checks.'
    );

    if (!confirmed) {
      return;
    }

    try {
      setRevoking(credentialId);
      setError(null);

      const response = await fetch('/api/credentials/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credentialId,
          reason: 'Revoked by credential holder',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke credential');
      }

      // Refresh credentials list
      await fetchCredentials();

      // Show appropriate success message
      const message = data.legacy 
        ? '✅ Legacy credential revoked successfully!\n\nNote: This credential was created before W3C Status List implementation, so revocation is recorded in the database only.'
        : '✅ Credential revoked successfully!\n\nThe W3C Bitstring Status List has been updated.';
      
      alert(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke credential');
      alert('❌ ' + (err instanceof Error ? err.message : 'Failed to revoke credential'));
    } finally {
      setRevoking(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Verifiable Credentials</h2>
        <p className="text-gray-500">Loading credentials...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-semibold">Verifiable Credentials</h2>
          <p className="text-sm text-gray-600 mt-1">
            W3C-compliant digital credentials you can share with verifiers
          </p>
        </div>
        <button
          onClick={issueNewCredential}
          disabled={issuing}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {issuing ? 'Issuing...' : '+ Issue Credential'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {credentials.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
          <span className="text-4xl mb-3 block">🎫</span>
          <p className="text-gray-600 mb-4">No credentials issued yet</p>
          <p className="text-sm text-gray-500 mb-4">
            Issue a verifiable credential to prove your verified identity to third parties
          </p>
          <button
            onClick={issueNewCredential}
            disabled={issuing}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 font-medium transition-colors"
          >
            {issuing ? 'Issuing...' : 'Issue Your First Credential'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {credentials.map((item) => {
            const { credential, metadata } = item;
            const isExpired = metadata.expiresAt && new Date(metadata.expiresAt) < new Date();
            const isActive = !metadata.isRevoked && !isExpired;

            return (
              <div
                key={metadata.id}
                className={`border-2 rounded-lg p-4 transition-all ${
                  isActive
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-gray-50 opacity-75'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900">
                        {metadata.credentialType.replace('Credential', ' Credential')}
                      </h3>
                      {isActive && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded-full font-medium">
                          Active
                        </span>
                      )}
                      {metadata.isRevoked && (
                        <span className="px-2 py-1 bg-red-600 text-white text-xs rounded-full font-medium">
                          Revoked
                        </span>
                      )}
                      {isExpired && !metadata.isRevoked && (
                        <span className="px-2 py-1 bg-orange-600 text-white text-xs rounded-full font-medium">
                          Expired
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <strong>Issued:</strong> {new Date(metadata.issuedAt).toLocaleDateString()}{' '}
                        at {new Date(metadata.issuedAt).toLocaleTimeString()}
                      </p>
                      {metadata.expiresAt && (
                        <p>
                          <strong>Expires:</strong>{' '}
                          {new Date(metadata.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 font-mono break-all">
                        <strong>ID:</strong> {metadata.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => downloadCredential(metadata.id)}
                      className="px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors font-medium"
                      title="Download as JSON"
                    >
                      📥 Download
                    </button>
                    <Link
                      href={`/dashboard/credentials/${metadata.id}`}
                      className="px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors font-medium"
                      title="View details"
                    >
                      👁️ View
                    </Link>
                    {!metadata.isRevoked && (
                      <button
                        onClick={() => revokeCredential(metadata.id)}
                        disabled={revoking === metadata.id}
                        className="px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                        title="Revoke credential"
                      >
                        {revoking === metadata.id ? '⏳' : '🚫'} Revoke
                      </button>
                    )}
                  </div>
                </div>

                {/* DID Information */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-600 hover:text-gray-900 font-medium">
                      🔗 DID Information
                    </summary>
                    <div className="mt-2 space-y-1 text-gray-600 font-mono">
                      <p className="break-all">
                        <strong>Holder:</strong> {metadata.holderDid}
                      </p>
                      <p className="break-all">
                        <strong>Issuer:</strong> {credential.issuer}
                      </p>
                    </div>
                  </details>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">ℹ️ About Verifiable Credentials</h3>
        <p className="text-sm text-blue-800">
          These credentials are W3C-compliant, cryptographically signed proofs of your verified
          identity. You can share them with third parties who can verify their authenticity without
          contacting us.
        </p>
        <p className="text-sm text-blue-800 mt-2">
          <strong>Standards:</strong> W3C VC Data Model 1.1, DID Core 1.0, Ed25519Signature2020
        </p>
      </div>
    </div>
  );
}
