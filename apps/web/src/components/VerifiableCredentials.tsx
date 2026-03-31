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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Eye, Ban, FileText, Shield, AlertCircle, Info } from 'lucide-react';

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

      const data = await response.json();

      if (!response.ok) {
        // Show specific error message from API
        throw new Error(data.error || 'Failed to issue credential');
      }

      // Refresh credentials list
      await fetchCredentials();

      alert('✅ Credential issued successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to issue credential';
      setError(errorMessage);
      alert('❌ ' + errorMessage);
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
      <Card>
        <CardHeader>
          <CardTitle>Verifiable Credentials</CardTitle>
          <CardDescription>Loading credentials...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verifiable Credentials
            </CardTitle>
            <CardDescription className="mt-1.5">
              W3C-compliant digital credentials you can share with verifiers
            </CardDescription>
          </div>
          <Button
            onClick={issueNewCredential}
            disabled={issuing}
            variant="default"
            className="w-full md:w-auto"
          >
            <FileText className="h-4 w-4 mr-2" />
            {issuing ? 'Issuing...' : 'Issue Credential'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <p className="text-sm text-destructive">
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {credentials.length === 0 ? (
          <div className="text-center py-10 md:py-12 border-2 border-dashed border-border rounded-lg">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No credentials issued yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Issue a verifiable credential to prove your verified identity to third parties
            </p>
            <Button
              onClick={issueNewCredential}
              disabled={issuing}
              size="lg"
              className="w-full sm:w-auto"
            >
              <FileText className="h-4 w-4 mr-2" />
              {issuing ? 'Issuing...' : 'Issue Your First Credential'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {credentials.map((item) => {
              const { credential, metadata } = item;
              const isExpired = metadata.expiresAt && new Date(metadata.expiresAt) < new Date();
              const isActive = !metadata.isRevoked && !isExpired;

              return (
                <Card
                  key={metadata.id}
                  className={`transition-all ${
                    isActive
                      ? 'border-green-500/50 bg-green-50/60 dark:bg-green-950/20'
                      : 'opacity-85 border-border'
                  }`}
                >
                  <CardHeader>
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <CardTitle className="text-lg">
                            {metadata.credentialType.replace('Credential', ' Credential')}
                          </CardTitle>
                          {isActive && (
                            <Badge
                              variant="default"
                              className="bg-green-600 hover:bg-green-600 text-white"
                            >
                              Active
                            </Badge>
                          )}
                          {metadata.isRevoked && <Badge variant="destructive">Revoked</Badge>}
                          {isExpired && !metadata.isRevoked && (
                            <Badge
                              variant="secondary"
                              className="bg-orange-600 hover:bg-orange-600 text-white"
                            >
                              Expired
                            </Badge>
                          )}
                        </div>

                        <div className="text-sm text-muted-foreground space-y-1 mt-2">
                          <p>
                            <strong>Issued:</strong>{' '}
                            {new Date(metadata.issuedAt).toLocaleDateString()} at{' '}
                            {new Date(metadata.issuedAt).toLocaleTimeString()}
                          </p>
                          {metadata.expiresAt && (
                            <p>
                              <strong>Expires:</strong>{' '}
                              {new Date(metadata.expiresAt).toLocaleDateString()}
                            </p>
                          )}
                          <p className="text-xs font-mono break-all">
                            <strong>ID:</strong> {metadata.id}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-2 lg:ml-4 w-full lg:w-auto">
                        <Button
                          onClick={() => downloadCredential(metadata.id)}
                          variant="default"
                          size="sm"
                          className="w-full"
                          title="Download as JSON"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="w-full"
                          title="View details"
                        >
                          <Link href={`/dashboard/credentials/${metadata.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                        {!metadata.isRevoked && (
                          <Button
                            onClick={() => revokeCredential(metadata.id)}
                            disabled={revoking === metadata.id}
                            variant="destructive"
                            size="sm"
                            className="w-full sm:col-span-2 lg:col-span-1"
                            title="Revoke credential"
                          >
                            <Ban className="h-4 w-4 mr-1" />
                            {revoking === metadata.id ? 'Revoking...' : 'Revoke'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <Separator className="mb-4" />
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        DID Information
                      </summary>
                      <div className="mt-3 space-y-2 text-muted-foreground font-mono text-xs">
                        <p className="break-all">
                          <strong>Holder:</strong> {metadata.holderDid}
                        </p>
                        <p className="break-all">
                          <strong>Issuer:</strong> {credential.issuer}
                        </p>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Info Box */}
        <Card className="mt-6 border-blue-300/70 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-5 w-5" />
              About Verifiable Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              These credentials are W3C-compliant, cryptographically signed proofs of your verified
              identity. You can share them with third parties who can verify their authenticity
              without contacting us.
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Standards:</strong> W3C VC Data Model 1.1, DID Core 1.0, Ed25519Signature2020
            </p>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
