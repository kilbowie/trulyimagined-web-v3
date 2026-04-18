'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { MockUser } from '@/lib/mock-auth';

interface MockAuthContextValue {
  user: MockUser | null;
  isLoading: boolean;
}

const MockAuthContext = createContext<MockAuthContextValue>({ user: null, isLoading: true });

export function MockAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mock-auth/me')
      .then((r) => r.json())
      .then((data) => setUser(data ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <MockAuthContext.Provider value={{ user, isLoading }}>
      {children}
    </MockAuthContext.Provider>
  );
}

export function useMockAuth(): MockAuthContextValue {
  return useContext(MockAuthContext);
}
