'use client';

import { Auth0Provider as AuthProvider } from '@auth0/nextjs-auth0/client';

/**
 * Auth0 User Provider
 *
 * Wrap your app with this component to enable client-side authentication
 */
export default function Auth0Provider({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider loginUrl="/api/auth/login" profileUrl="/api/auth/me">
      {children}
    </AuthProvider>
  );
}
