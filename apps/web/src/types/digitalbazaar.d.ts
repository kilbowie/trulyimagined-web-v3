/**
 * Type declarations for @digitalbazaar libraries
 * These libraries don't have official TypeScript types
 */

declare module '@digitalbazaar/vc' {
  export function issue(options: {
    credential: any;
    suite: any;
    documentLoader: (url: string) => Promise<any>;
  }): Promise<any>;

  export function verifyCredential(options: {
    credential: any;
    suite: any;
    documentLoader: (url: string) => Promise<any>;
  }): Promise<{ verified: boolean; error?: any }>;
}

declare module '@digitalbazaar/ed25519-signature-2020' {
  export class Ed25519Signature2020 {
    constructor(options: { key: any });
  }
}

declare module '@digitalbazaar/ed25519-verification-key-2020' {
  export class Ed25519VerificationKey2020 {
    id: string;
    controller: string;
    type: string;
    publicKeyMultibase: string;
    privateKeyMultibase?: string;

    static generate(options: {
      id: string;
      controller: string;
    }): Promise<Ed25519VerificationKey2020>;

    static from(options: {
      id: string;
      controller: string;
      publicKeyMultibase: string;
      privateKeyMultibase?: string;
    }): Promise<Ed25519VerificationKey2020>;
  }
}

declare module 'did-resolver' {
  export interface DIDDocument {
    '@context': string | string[];
    id: string;
    [key: string]: any;
  }

  export interface ResolverRegistry {
    [key: string]: any;
  }

  export class Resolver {
    constructor(registry: ResolverRegistry);
    resolve(did: string): Promise<{ didDocument: DIDDocument }>;
  }
}
