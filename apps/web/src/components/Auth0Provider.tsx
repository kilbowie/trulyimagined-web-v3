'use client';

import { Auth0Provider as Auth0ProviderSDK } from '@auth0/nextjs-auth0/client';

export default function Auth0Provider({ children }: { children: React.ReactNode }) {
  return <Auth0ProviderSDK>{children}</Auth0ProviderSDK>;
}
