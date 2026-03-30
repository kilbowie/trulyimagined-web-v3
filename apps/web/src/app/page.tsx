import AuthNav from '@/components/AuthNav';
import { getCurrentUser, getUserRoles } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Lock, FileCheck, CheckCircle, UserCheck, FileText, ArrowRight } from 'lucide-react';

export default async function Home() {
  // Check if user is authenticated and has a role
  const user = await getCurrentUser();

  if (user) {
    const roles = await getUserRoles();

    // If user is logged in but has no role, redirect to role selection
    if (roles.length === 0) {
      redirect('/select-role');
    }
  }

  return (
    <>
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 bg-slate-950 border-b border-slate-800 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Temporary fallback: Use Shield icon until R2 is configured */}
            <Shield className="h-6 w-6 text-blue-400" />
            {/* TODO: Uncomment when R2 public access is configured
            <img 
              src="https://assets.trulyimagined.com/logo.png" 
              alt="Truly Imagined Logo" 
              className="h-8 w-auto"
            />
            */}
            <h1 className="text-xl font-bold text-white">Truly Imagined</h1>
          </div>
          <AuthNav />
        </div>
      </header>

      <main className="min-h-screen">
        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-6 bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <div className="max-w-6xl mx-auto">
            <div className="text-center space-y-8">
              {/* Badge */}
              <Badge variant="outline" className="text-sm px-4 py-1">
                Rights Infrastructure for the AI Era
              </Badge>

              {/* Main Heading */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-5xl mx-auto leading-tight">
                The Global Registry for <span className="text-primary">Human Digital Identity</span>{' '}
                in AI
              </h1>

              {/* Subtitle */}
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Control and license your digital identity with the world&apos;s first compliance
                infrastructure built for actors in the age of artificial intelligence.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                {user ? (
                  <>
                    <Button size="lg" asChild className="text-lg px-8 py-6">
                      <Link href="/dashboard">
                        Go to Dashboard
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
                      <Link href="/dashboard/register-identity">Register Your Identity</Link>
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="lg" asChild className="text-lg px-8 py-6">
                      <Link href="/auth/login">
                        Get Started
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Link>
                    </Button>
                    <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
                      <Link href="/auth/login">Sign In</Link>
                    </Button>
                  </>
                )}
              </div>

              {/* Trust Badge */}
              <p className="text-sm text-muted-foreground pt-4">
                <Lock className="inline h-4 w-4 mr-1" />
                Secure • Compliant • Audit-Ready
              </p>
            </div>
          </div>
        </section>

        {/* Value Proposition */}
        <section className="py-20 px-6 bg-white dark:bg-slate-950">
          <div className="max-w-6xl mx-auto text-center space-y-6">
            <h2 className="text-3xl md:text-4xl font-bold">
              We Are Not an AI Tool. We Are{' '}
              <span className="text-primary">Rights Infrastructure</span>.
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Truly Imagined provides the foundational registry and compliance layer that enables
              actors to register their digital identity, define consent boundaries, and license
              their likeness for AI-generated content.
            </p>
          </div>
        </section>

        {/* How It Works - Combined with Infrastructure */}
        <section className="py-20 px-6 bg-slate-50 dark:bg-slate-900">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-lg text-muted-foreground">
                Three pillars of infrastructure, three simple steps to get started
              </p>
            </div>

            {/* Infrastructure Cards */}
            <div className="grid md:grid-cols-3 gap-8 mb-20">
              {/* Identity Registry */}
              <Card className="border-2 hover:border-primary transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <UserCheck className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Identity Registry</CardTitle>
                  <CardDescription>
                    Secure registration and verification of actor identities
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Unique Registry ID for every actor</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Verified professional identity</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Prevents unauthorized AI usage</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Consent Ledger */}
              <Card className="border-2 hover:border-primary transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <FileCheck className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Consent Ledger</CardTitle>
                  <CardDescription>
                    Immutable, timestamped record of all permissions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Append-only audit trail</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Every decision is logged</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Regulatory compliance ready</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Licensing Control */}
              <Card className="border-2 hover:border-primary transition-colors">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Licensing Control</CardTitle>
                  <CardDescription>Actor-owned preferences for AI usage</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Define consent boundaries</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>Control where your likeness appears</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>License on your own terms</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Steps Timeline */}
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h3 className="text-2xl font-bold mb-2">Get Started in Minutes</h3>
                <p className="text-muted-foreground">Three simple steps to protect your identity</p>
              </div>

              <div className="space-y-8">
                {/* Step 1 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      1
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xl font-semibold">Register Your Identity</h4>
                    <p className="text-muted-foreground">
                      Create your account and register your professional identity in our global
                      registry. Receive your unique Registry ID.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Step 2 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      2
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xl font-semibold">Define Your Consent</h4>
                    <p className="text-muted-foreground">
                      Set clear boundaries for how your digital identity can be used in AI-generated
                      content. Update preferences anytime.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* Step 3 */}
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                      3
                    </div>
                  </div>
                  <div className="space-y-2 pt-2">
                    <h4 className="text-xl font-semibold">License & Control</h4>
                    <p className="text-muted-foreground">
                      License your likeness on your terms. Track usage, manage consents, and
                      maintain full control through your dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 px-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent dark:from-primary/20 dark:via-primary/10">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold">
              Ready to Control Your Digital Identity?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join the global registry and take control of how your likeness is used in artificial
              intelligence. Registration takes less than 2 minutes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              {user ? (
                <>
                  <Button size="lg" asChild className="text-lg px-8 py-6">
                    <Link href="/dashboard/register-identity">
                      Register Your Identity
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
                    <Link href="/dashboard">View Dashboard</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button size="lg" asChild className="text-lg px-8 py-6">
                    <Link href="/auth/login">
                      Create Account
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="text-lg px-8 py-6">
                    <Link href="/auth/login">Sign In</Link>
                  </Button>
                </>
              )}
            </div>

            <p className="text-sm text-muted-foreground pt-4">
              Building trust-first infrastructure for the age of AI
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-6 border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <div className="max-w-6xl mx-auto text-center text-sm text-muted-foreground">
            <p>Registry • Compliance • Auditability</p>
            <p className="mt-2">
              © {new Date().getFullYear()} Truly Imagined. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
