'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

type QuickNavItem = {
  title: string;
  description: string;
  href: string;
  keywords: string[];
  allowedRoles?: string[];
};

const QUICK_NAV_ITEMS: QuickNavItem[] = [
  {
    title: 'Dashboard Home',
    description: 'Overview and quick actions',
    href: '/dashboard',
    keywords: ['home', 'overview', 'dashboard'],
  },
  {
    title: 'Account Settings',
    description: 'Manage account preferences and security',
    href: '/dashboard/account/settings',
    keywords: ['account', 'settings', 'security', 'billing', 'preferences'],
  },
  {
    title: 'Profile',
    description: 'Your actor profile details',
    href: '/dashboard/profile',
    keywords: ['profile', 'account', 'bio'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'Upload Media',
    description: 'Upload photos and media assets',
    href: '/dashboard/upload-media',
    keywords: ['media', 'upload', 'photos', 'images'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'Consent Preferences',
    description: 'Manage data-sharing preferences',
    href: '/dashboard/consent-preferences',
    keywords: ['consent', 'preferences', 'privacy', 'settings'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'Consent History',
    description: 'Review prior consent decisions',
    href: '/dashboard/consent-history',
    keywords: ['consent', 'history', 'records', 'audit'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'Register Identity',
    description: 'Register your identity profile',
    href: '/dashboard/register-identity',
    keywords: ['identity', 'register', 'registry'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'Verify Identity',
    description: 'Complete identity verification',
    href: '/dashboard/verify-identity',
    keywords: ['identity', 'verify', 'verification', 'kyc'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'Verifiable Credentials',
    description: 'Issue and manage digital credentials',
    href: '/dashboard/verifiable-credentials',
    keywords: ['credentials', 'verifiable', 'w3c', 'proof'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'License Tracker',
    description: 'Monitor API client licenses',
    href: '/dashboard/licenses',
    keywords: ['license', 'licensing', 'tracker', 'permissions'],
    allowedRoles: ['Actor'],
  },
  {
    title: 'Support Tickets',
    description: 'Create and manage support tickets',
    href: '/dashboard/support',
    keywords: ['support', 'help', 'tickets', 'issues'],
  },
  {
    title: 'User Feedback',
    description: 'View submitted user feedback',
    href: '/dashboard/admin/feedback',
    keywords: ['feedback', 'admin', 'messages'],
    allowedRoles: ['Admin'],
  },
  {
    title: 'IAM Users',
    description: 'Manage IAM users and roles',
    href: '/dashboard/iam/users',
    keywords: ['iam', 'users', 'roles', 'admin'],
    allowedRoles: ['Admin'],
  },
  {
    title: 'Consents',
    description: 'Consent dashboard and records',
    href: '/dashboard/consents',
    keywords: ['consents', 'privacy', 'records'],
  },
  {
    title: 'Users',
    description: 'User directory view',
    href: '/dashboard/users',
    keywords: ['users', 'directory'],
    allowedRoles: ['Admin'],
  },
];

function scoreItem(item: QuickNavItem, query: string): number {
  if (!query) return 1;

  const q = query.toLowerCase();
  const haystack =
    `${item.title} ${item.description} ${item.href} ${item.keywords.join(' ')}`.toLowerCase();

  if (item.title.toLowerCase().startsWith(q)) return 120;
  if (item.title.toLowerCase().includes(q)) return 90;
  if (item.keywords.some((keyword) => keyword.startsWith(q))) return 80;
  if (item.keywords.some((keyword) => keyword.includes(q))) return 70;
  if (item.description.toLowerCase().includes(q)) return 50;
  if (item.href.toLowerCase().includes(q)) return 40;
  if (haystack.includes(q)) return 20;

  return 0;
}

type DashboardQuickSearchProps = {
  roles?: string[];
};

function canAccessItem(item: QuickNavItem, roles: string[]): boolean {
  if (!item.allowedRoles || item.allowedRoles.length === 0) {
    return true;
  }

  return item.allowedRoles.some((role) => roles.includes(role));
}

export function DashboardQuickSearch({ roles = [] }: DashboardQuickSearchProps) {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const visibleItems = useMemo(
    () => QUICK_NAV_ITEMS.filter((item) => canAccessItem(item, roles)),
    [roles]
  );

  const results = useMemo(() => {
    const ranked = visibleItems
      .map((item) => ({
        item,
        score: scoreItem(item, query),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .map((entry) => entry.item);

    return ranked.slice(0, 8);
  }, [query, visibleItems]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  function navigateTo(target: QuickNavItem) {
    if (pathname !== target.href) {
      router.push(target.href);
    }
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open && event.key === 'ArrowDown' && results.length > 0) {
      setOpen(true);
      setActiveIndex(0);
      return;
    }

    if (!open) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[activeIndex] || results[0];
      if (selected) {
        navigateTo(selected);
      }
      return;
    }

    if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Quick search features and settings..."
          autoComplete="off"
          spellCheck={false}
          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none ring-offset-background transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          aria-label="Quick navigation search"
        />
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
          {results.map((result, index) => {
            const isActive = index === activeIndex;
            const isCurrent = pathname === result.href;

            return (
              <button
                key={result.href}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => navigateTo(result)}
                className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-popover-foreground hover:bg-accent/70'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{result.title}</span>
                  {isCurrent && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Current
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{result.description}</div>
              </button>
            );
          })}
        </div>
      )}

      {open && results.length === 0 && query.trim().length > 0 && (
        <div className="absolute z-30 mt-2 w-full rounded-lg border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg">
          No matching features found.
        </div>
      )}
    </div>
  );
}
