'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import Link from 'next/link';

/**
 * Navigation component with auth-aware login/logout buttons
 */
export default function AuthNav() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <nav className="flex items-center gap-4">
        <div className="h-8 w-20 bg-gray-200 animate-pulse rounded"></div>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="flex items-center gap-4">
        <a
          href="/auth/login"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          Log In
        </a>
      </nav>
    );
  }

  const roles = user['https://trulyimagined.com/roles'] || [];

  return (
    <nav className="flex items-center gap-6">
      <div className="flex items-center gap-2">
        {user.picture && (
          <img src={user.picture} alt={user.name || 'User'} className="w-8 h-8 rounded-full" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.name || user.email}</span>
          {roles.length > 0 && <span className="text-xs text-gray-500">{roles.join(', ')}</span>}
        </div>
      </div>

      <Link href="/dashboard" className="text-sm hover:text-blue-600 transition">
        Dashboard
      </Link>

      <a
        href="/api/auth/logout"
        className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition text-sm"
      >
        Log Out
      </a>
    </nav>
  );
}
