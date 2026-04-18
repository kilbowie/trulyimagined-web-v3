'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import AuthNav from '@/components/AuthNav';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  ArrowRight,
  ShieldCheck,
  FileCheck,
  UserCheck,
  FileText,
  CheckCircle,
  Zap,
  Globe,
  Lock,
  Star,
  ChevronRight,
} from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import ScrollReveal from '@/components/landing/ScrollReveal';
import TrustMarquee from '@/components/landing/TrustMarquee';
import IdentityVisual from '@/components/landing/IdentityVisual';

/* ── Animated number counter hook ──────────────────────────────────────── */
function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const triggered = useRef(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !triggered.current) {
          triggered.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { rootMargin: '-40px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { count, ref };
}

/* ── 3D tilt handler ────────────────────────────────────────────────────── */
function use3DTilt() {
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
    el.style.setProperty('--ry', `${(x * 8).toFixed(2)}deg`);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  return { ref, handleMouseMove, handleMouseLeave };
}

export default function Home() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const { count: countryCount, ref: countryRef } = useCountUp(190, 1400);

  // Cursor spotlight on hero
  const heroRef = useRef<HTMLElement>(null);
  const handleHeroMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  }, []);

  // 3D bento card tilt
  const bentoTilt = use3DTilt();

  // Resolve auth state client-side (works with both real Auth0 + mock)
  useEffect(() => {
    const isMock = process.env.NEXT_PUBLIC_MOCK_AUTH === 'true';
    if (isMock) {
      fetch('/api/mock-auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) setUser(data); })
        .catch(() => {});
    } else {
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => { if (data) setUser(data); })
        .catch(() => {});
    }
  }, []);

  return (
    <>
      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-blue-100/80 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="flex items-center">
            <img
              src="/logo.svg"
              alt="Truly Imagined"
              className="h-8 w-auto transition-transform duration-200 hover:scale-105 cursor-pointer"
            />
          </Link>
          <AuthNav />
        </div>
      </header>

      <main>

        {/* ════════════════════════════════════════════════════════════════════
            HERO — Asymmetric: text left · identity visual right
            ════════════════════════════════════════════════════════════════════ */}
        <section
          ref={heroRef}
          onMouseMove={handleHeroMouseMove}
          className="hero-blueprint spotlight-hero relative pt-32 pb-20 px-6 overflow-hidden"
        >
          {/* Blue aurora — depth from bottom-right */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
            <div className="absolute bottom-0 right-0 w-[700px] h-[500px] bg-blue-500/7 blur-[110px] rounded-full translate-x-1/4 translate-y-1/4" />
            <div className="absolute top-1/4 left-0 w-[350px] h-[280px] bg-blue-400/4 blur-[80px] rounded-full -translate-x-1/3" />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="lg:grid lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_480px] lg:gap-16 lg:items-center">

              {/* ── Left: Copy ─────────────────────────────────────────── */}
              <div className="space-y-7 max-w-2xl">

                {/* Eyebrow */}
                <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full surface-chrome text-sm font-semibold text-blue-700 tracking-wide">
                  <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
                  The World&apos;s First AI Identity Registry
                  <Star className="h-3.5 w-3.5 fill-current text-yellow-500" />
                </div>

                {/* Headline */}
                <div className="space-y-3">
                  <h1 className="font-display text-5xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] font-extrabold tracking-tight leading-[1.0] text-[hsl(222,47%,11%)]">
                    You are more than
                    <br />
                    <span className="text-gold-shimmer">your image.</span>
                  </h1>
                  <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-blue-600">
                    Own how AI sees you.
                  </h2>
                </div>

                {/* Subtitle */}
                <p className="text-lg text-slate-500 leading-relaxed max-w-xl">
                  The compliance infrastructure that gives performers, creators, and individuals
                  legal control over their digital identity in AI — before someone else decides for you.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  {user ? (
                    <>
                      <Button
                        size="lg"
                        asChild
                        className="glow-blue text-base px-7 py-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/20"
                      >
                        <Link href="/dashboard">
                          Go to Dashboard
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        asChild
                        className="text-base px-7 py-6 border-2 border-[hsl(44,75%,46%)] text-[hsl(40,80%,36%)] hover:bg-[hsl(44,75%,46%)]/8 font-semibold"
                      >
                        <Link href="/dashboard/register-identity">Register Your Identity</Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="lg"
                        asChild
                        className="glow-blue text-base px-7 py-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-500/20"
                      >
                        <Link href="/auth/login">
                          Claim Your Identity
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Link>
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        asChild
                        className="text-base px-7 py-6 border-2 border-[hsl(44,75%,46%)] text-[hsl(40,80%,36%)] hover:bg-[hsl(44,75%,46%)]/8 font-semibold"
                      >
                        <Link href="/auth/login">Sign In</Link>
                      </Button>
                    </>
                  )}
                </div>

                {/* Trust row */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
                  {[
                    { icon: Lock,        text: 'Legally binding' },
                    { icon: ShieldCheck, text: 'GPG 45 & eIDAS aligned' },
                    { icon: Globe,       text: 'Global registry' },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-1.5 text-sm text-slate-400 font-medium">
                      <Icon className="h-4 w-4 text-blue-400" />
                      {text}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Right: Identity Visual ──────────────────────────────── */}
              <div className="hidden lg:flex items-center justify-center h-[420px] xl:h-[480px]">
                <IdentityVisual />
              </div>
            </div>
          </div>

          {/* Bottom fade */}
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-10" />
        </section>

        {/* ── Trust marquee ─────────────────────────────────────────────────── */}
        <TrustMarquee />

        {/* ════════════════════════════════════════════════════════════════════
            TRANSITION — "Stepping in" bridge
            ════════════════════════════════════════════════════════════════════ */}
        <section className="relative py-24 px-6 bg-gradient-to-b from-white via-blue-50/50 to-blue-100/30 overflow-hidden">

          {/* Offset decorative number — typographic texture */}
          <div
            aria-hidden
            className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-display font-extrabold text-[20rem] leading-none text-blue-100/40 select-none -translate-x-8"
          >
            AI
          </div>

          <div className="relative max-w-5xl mx-auto">
            <div className="max-w-3xl">
              <ScrollReveal animation="up">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-500 mb-4">
                  The Problem We Solve
                </p>
                <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold text-[hsl(222,47%,11%)] leading-[1.05] mb-6">
                  AI is already using
                  <br />
                  <span className="text-blue-600">your face.</span>
                </h2>
                <p className="text-xl text-slate-500 leading-relaxed max-w-xl mb-2">
                  Who gave it permission?
                </p>
                <p className="text-base text-slate-400 leading-relaxed max-w-lg">
                  Deepfakes. Synthetic voices. AI-generated likenesses. The technology exists.
                  The rights infrastructure didn&apos;t — until now.
                </p>
              </ScrollReveal>
            </div>

            {/* Metrics — staggered reveal */}
            <div className="grid grid-cols-3 gap-8 mt-16 max-w-2xl">
              <ScrollReveal animation="up" delay={1}>
                <div className="space-y-1">
                  <div className="font-display text-5xl font-extrabold text-gold-gradient">
                    #1
                  </div>
                  <div className="text-sm text-slate-500 leading-tight">Identity registry for performers</div>
                </div>
              </ScrollReveal>
              <ScrollReveal animation="up" delay={2}>
                <div ref={countryRef} className="space-y-1">
                  <div className="font-display text-5xl font-extrabold text-gold-gradient">
                    {countryCount}+
                  </div>
                  <div className="text-sm text-slate-500 leading-tight">Countries recognised</div>
                </div>
              </ScrollReveal>
              <ScrollReveal animation="up" delay={3}>
                <div className="space-y-1">
                  <div className="font-display text-5xl font-extrabold text-gold-gradient">
                    W3C
                  </div>
                  <div className="text-sm text-slate-500 leading-tight">Verifiable credentials standard</div>
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            DIGIVERSE — Bento grid layout
            ════════════════════════════════════════════════════════════════════ */}
        <section className="bg-digiverse relative py-24 px-6">

          <div aria-hidden className="digiverse-grid absolute inset-0 opacity-[0.07]" />
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[180px] bg-yellow-400/5 blur-[80px]"
          />

          <div className="relative max-w-6xl mx-auto">

            {/* Section header */}
            <ScrollReveal animation="up">
              <div className="text-center mb-14">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400/80 mb-4">
                  Infrastructure
                </p>
                <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight">
                  Three pillars.{' '}
                  <span className="text-gold-gradient">One identity.</span>
                </h2>
                <p className="text-blue-200/55 mt-4 max-w-lg mx-auto">
                  Composable, legally robust, built on open standards.
                </p>
              </div>
            </ScrollReveal>

            {/* ── Bento grid ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">

              {/* Identity Registry — large card (spans 2 rows on lg) */}
              <ScrollReveal animation="left" className="lg:row-span-2">
                <div
                  ref={bentoTilt.ref}
                  onMouseMove={bentoTilt.handleMouseMove}
                  onMouseLeave={bentoTilt.handleMouseLeave}
                  className="card-3d group relative h-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 hover:border-yellow-400/35 hover:bg-white/8 transition-all duration-300 cursor-default"
                >
                  {/* Gold top line on hover */}
                  <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-yellow-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center mb-7 group-hover:bg-blue-500/30 transition-colors">
                    <UserCheck className="h-7 w-7 text-blue-300" />
                  </div>

                  <h3 className="font-display font-bold text-2xl text-white mb-3">
                    Identity Registry
                  </h3>
                  <p className="text-blue-200/60 leading-relaxed mb-8 text-base">
                    Secure registration and cryptographic verification of performer identities
                    against global compliance frameworks. Your unique Registry ID travels with
                    you across every AI system.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {[
                      'Unique Registry ID (DID-compliant)',
                      'Multi-factor identity verification',
                      'GPG 45 & eIDAS 2.0 aligned',
                      'Prevents unauthorised AI usage',
                    ].map((pt) => (
                      <li key={pt} className="flex items-start gap-3 text-sm text-blue-100/70">
                        <CheckCircle className="h-4 w-4 text-yellow-400/70 mt-0.5 shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <Link
                      href="/auth/login"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-yellow-400/80 hover:text-yellow-300 transition-colors"
                    >
                      Register your identity
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </ScrollReveal>

              {/* Consent Ledger — top-right */}
              <ScrollReveal animation="right" delay={1}>
                <div className="group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 hover:border-yellow-400/30 hover:bg-white/8 transition-all duration-300">
                  <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-colors">
                    <FileCheck className="h-5 w-5 text-blue-300" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-2">Consent Ledger</h3>
                  <p className="text-sm text-blue-200/60 leading-relaxed mb-5">
                    Immutable, timestamped record of all permissions granted or denied — a legally
                    defensible audit trail.
                  </p>
                  <ul className="space-y-2">
                    {[
                      'Append-only audit trail',
                      'Every decision logged & signed',
                      'Regulatory compliance ready',
                    ].map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-sm text-blue-100/70">
                        <CheckCircle className="h-4 w-4 text-yellow-400/70 mt-0.5 shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>

              {/* Licensing Control — bottom-right */}
              <ScrollReveal animation="right" delay={2}>
                <div className="group relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 hover:border-yellow-400/30 hover:bg-white/8 transition-all duration-300">
                  <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-yellow-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="w-11 h-11 rounded-xl bg-blue-500/20 border border-blue-400/20 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-colors">
                    <FileText className="h-5 w-5 text-blue-300" />
                  </div>
                  <h3 className="font-display font-bold text-xl text-white mb-2">Licensing Control</h3>
                  <p className="text-sm text-blue-200/60 leading-relaxed mb-5">
                    Performer-owned licensing terms that travel with your identity wherever it goes
                    in the AI ecosystem.
                  </p>
                  <ul className="space-y-2">
                    {[
                      'Define your consent boundaries',
                      'Control AI usage of your likeness',
                      'License on your own terms',
                    ].map((pt) => (
                      <li key={pt} className="flex items-start gap-2.5 text-sm text-blue-100/70">
                        <CheckCircle className="h-4 w-4 text-yellow-400/70 mt-0.5 shrink-0" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            </div>

            {/* ── How it works — left-aligned timeline ──────────────────── */}
            <div className="lg:grid lg:grid-cols-[auto_1fr] lg:gap-16 lg:items-start">

              <ScrollReveal animation="left">
                <div className="lg:sticky lg:top-28 mb-12 lg:mb-0">
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-yellow-400/80 mb-3">
                    How it works
                  </p>
                  <h3 className="font-display text-2xl md:text-3xl font-bold text-white mb-3">
                    Protected in
                    <br />
                    <span className="text-gold-gradient">minutes.</span>
                  </h3>
                  <p className="text-blue-200/50 text-sm max-w-[220px]">
                    Three steps to full legal control over your identity.
                  </p>
                </div>
              </ScrollReveal>

              <div className="space-y-0">
                {[
                  {
                    icon: ShieldCheck,
                    title: 'Register Your Identity',
                    body: 'Create your account and register in the global registry. Receive your unique, verifiable Registry ID.',
                  },
                  {
                    icon: Zap,
                    title: 'Define Your Consent',
                    body: 'Set clear, legally-enforceable boundaries for how your digital identity can be used in AI-generated content.',
                  },
                  {
                    icon: Globe,
                    title: 'License & Control',
                    body: 'License your likeness on your terms. Monitor usage and maintain full legal control through your dashboard.',
                  },
                ].map((step, i) => (
                  <ScrollReveal key={step.title} animation="up" delay={(i + 1) as 1 | 2 | 3}>
                    <div className="flex gap-6 py-8 border-b border-white/8 last:border-0">
                      <div className="shrink-0">
                        <div className="shimmer-gold w-10 h-10 rounded-full bg-gradient-to-br from-[hsl(44,75%,46%)] to-[hsl(40,80%,36%)] flex items-center justify-center font-display font-bold text-sm text-white shadow-lg shadow-yellow-600/20">
                          {i + 1}
                        </div>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        <h4 className="font-display font-semibold text-lg text-white">{step.title}</h4>
                        <p className="text-blue-200/55 leading-relaxed">{step.body}</p>
                      </div>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[hsl(222,47%,7%)] to-transparent pointer-events-none" />
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            SOCIAL PROOF — horizontal stat band
            ════════════════════════════════════════════════════════════════════ */}
        <section className="bg-[hsl(222,47%,7%)] border-t border-white/6 py-14 px-6">
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 'W3C', label: 'Standards compliant' },
              { value: 'GPG 45', label: 'UK framework aligned' },
              { value: 'eIDAS 2.0', label: 'EU identity ready' },
              { value: '2 min', label: 'To register' },
            ].map(({ value, label }, i) => (
              <ScrollReveal key={label} animation="up" delay={(i % 4 + 1) as 1 | 2 | 3}>
                <div>
                  <div className="font-display text-2xl font-extrabold text-white mb-1">{value}</div>
                  <div className="text-xs text-blue-300/50 uppercase tracking-wider font-semibold">{label}</div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════════
            FINAL CTA — Back to light / emergence
            ════════════════════════════════════════════════════════════════════ */}
        <section className="relative py-32 px-6 bg-white overflow-hidden">

          {/* Soft blue glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full" />
          </div>

          {/* Gold arc */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-px bg-gradient-to-r from-transparent via-[hsl(44,75%,46%)] to-transparent" />

          <div className="relative max-w-3xl mx-auto text-center space-y-8">
            <ScrollReveal animation="up">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-500">
                Join the Registry
              </p>
              <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05] text-[hsl(222,47%,11%)] mt-4">
                Your identity is{' '}
                <span className="text-gold-shimmer">worth protecting.</span>
              </h2>
              <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed mt-4">
                Registration takes under 2 minutes. Be part of the infrastructure that puts humans
                back in control of the AI era.
              </p>
            </ScrollReveal>

            <ScrollReveal animation="up" delay={1}>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
                {user ? (
                  <>
                    <Button
                      size="lg"
                      asChild
                      className="glow-blue text-base px-10 py-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xl shadow-blue-500/20"
                    >
                      <Link href="/dashboard/register-identity">
                        Register Your Identity
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      asChild
                      className="text-base px-10 py-6 border-2 border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 font-semibold"
                    >
                      <Link href="/dashboard">View Dashboard</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="lg"
                      asChild
                      className="glow-blue text-base px-10 py-6 bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xl shadow-blue-500/20"
                    >
                      <Link href="/auth/login">
                        Create Free Account
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      asChild
                      className="text-base px-10 py-6 border-2 border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 font-semibold"
                    >
                      <Link href="/auth/login">Sign In</Link>
                    </Button>
                  </>
                )}
              </div>
            </ScrollReveal>
          </div>
        </section>

      </main>

      <SiteFooter />
    </>
  );
}
