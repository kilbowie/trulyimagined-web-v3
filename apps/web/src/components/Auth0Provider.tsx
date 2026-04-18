'use client';

import { Auth0Provider as Auth0ProviderSDK } from '@auth0/nextjs-auth0/client';
import { MockAuthProvider } from '@/components/MockAuthProvider';

const IS_MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';

export default function Auth0Provider({ children }: { children: React.ReactNode }) {
  if (IS_MOCK_AUTH) {
    return <MockAuthProvider>{children}</MockAuthProvider>;
  }
  return <Auth0ProviderSDK>{children}</Auth0ProviderSDK>;
}
