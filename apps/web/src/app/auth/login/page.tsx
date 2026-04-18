'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const MOCK_ACCOUNTS = [
  { email: 'actor@test.com', role: 'Actor', description: 'Performer identity & consent' },
  { email: 'agent@test.com', role: 'Agent', description: 'Agency management workspace' },
  { email: 'studio@test.com', role: 'Studio', description: 'Studio integration panel' },
  { email: 'admin@test.com', role: 'Admin', description: 'Platform administration' },
];

export default function MockLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/mock-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Invalid credentials');
        setLoading(false);
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  function fillAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword('password');
    setError('');
  }

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── Left panel — brand / identity statement ── */}
      <div className="hidden lg:flex lg:w-1/2 bg-digiverse relative flex-col justify-between p-12 overflow-hidden">

        {/* Dot grid */}
        <div aria-hidden className="digiverse-grid absolute inset-0 opacity-[0.06]" />

        {/* Gold aurora top */}
        <div
          aria-hidden
          className="absolute top-0 right-0 w-96 h-96 bg-yellow-400/8 blur-[100px] pointer-events-none"
        />

        {/* Logo */}
        <Link href="/">
          <img src="/logo.svg" alt="Truly Imagined" className="h-8 w-auto relative z-10 brightness-0 invert" />
        </Link>

        {/* Headline */}
        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300/70">
              Identity Infrastructure
            </p>
            <h2 className="font-display text-4xl font-extrabold text-white leading-tight">
              Step into the<br />
              <span className="text-gold-gradient">digital frontier.</span>
            </h2>
            <p className="text-blue-200/60 text-lg leading-relaxed max-w-sm">
              Your identity. Your consent. Your terms — legally enforced across every AI system.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3">
            {[
              'W3C Verifiable Credentials',
              'GPG 45 & eIDAS compliance',
              'Immutable consent ledger',
              'Global AI licensing control',
            ].map((feat) => (
              <li key={feat} className="flex items-center gap-3 text-sm text-blue-100/70">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400/80 shrink-0" />
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-xs text-blue-300/40 font-medium">
          © {new Date().getFullYear()} Truly Imagined UK Limited
        </p>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 lg:px-16">

        {/* Mobile logo */}
        <div className="lg:hidden mb-8">
          <Link href="/">
            <img src="/logo.svg" alt="Truly Imagined" className="h-7 w-auto" />
          </Link>
        </div>

        <div className="max-w-sm w-full mx-auto lg:mx-0 space-y-8">

          {/* Header */}
          <div>
            <h1 className="font-display text-3xl font-bold text-[hsl(222,47%,11%)] tracking-tight">
              Welcome back
            </h1>
            <p className="mt-2 text-slate-500 text-sm">
              Sign in to your identity dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors shadow-sm"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors shadow-sm"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-semibold text-sm rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 shadow-lg shadow-blue-500/20"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-slate-400 font-medium uppercase tracking-wider">
                Dev accounts
              </span>
            </div>
          </div>

          {/* Quick-fill test accounts */}
          <div className="grid grid-cols-2 gap-2">
            {MOCK_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillAccount(account.email)}
                className="group text-left px-3.5 py-3 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[hsl(44,75%,46%)] shrink-0" />
                  <span className="text-xs font-bold text-slate-700 group-hover:text-blue-700">
                    {account.role}
                  </span>
                </div>
                <p className="text-xs text-slate-400 pl-3.5 leading-tight">{account.description}</p>
              </button>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center">
            All test accounts use password{' '}
            <span className="font-mono font-semibold text-slate-500">password</span>
          </p>
        </div>
      </div>
    </div>
  );
}
