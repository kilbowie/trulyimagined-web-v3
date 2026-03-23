import AuthNav from '@/components/AuthNav';

export default function Home() {
  return (
    <>
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Truly Imagined</h1>
          <AuthNav />
        </div>
      </header>

      <main className="flex min-h-screen flex-col items-center justify-center p-24 pt-32">
        <div className="z-10 max-w-5xl w-full items-center justify-center">
          <div className="text-center space-y-8">
            {/* Hero Section */}
            <div className="space-y-4">
              <h1 className="text-5xl font-bold tracking-tight">
                The Global Registry for Human Digital Identity in AI
              </h1>
              <p className="text-2xl text-gray-600 max-w-3xl mx-auto">
                Compliance infrastructure that gives actors control over how their digital identity is used in artificial intelligence.
              </p>
            </div>

            {/* Value Proposition */}
            <div className="pt-8 space-y-6">
              <h2 className="text-3xl font-semibold">
                Control and License Your Digital Identity in AI
              </h2>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                Truly Imagined is not an AI tool. We are <strong>rights infrastructure</strong>.
              </p>
              <p className="text-lg text-gray-700 max-w-2xl mx-auto">
                We provide the foundational registry and compliance layer that enables actors to register their digital identity, 
                define consent boundaries, and license their likeness for AI-generated content.
              </p>
            </div>

            {/* Core Pillars */}
            <div className="grid md:grid-cols-3 gap-8 pt-12 max-w-4xl mx-auto">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Identity Registry</h3>
                <p className="text-gray-600">
                  Secure registration and verification of actor identity for AI usage tracking.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Consent Ledger</h3>
                <p className="text-gray-600">
                  Immutable, timestamped record of all permissions and usage decisions.
                </p>
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold">Licensing Control</h3>
                <p className="text-gray-600">
                  Actor-owned preferences for how, when, and where their digital identity can be licensed.
                </p>
              </div>
            </div>

            {/* CTA Section */}
            <div className="pt-12 space-y-4">
              <p className="text-lg font-medium">
                Building trust-first infrastructure for the age of AI.
              </p>
              <p className="text-sm text-gray-500">
                Registry • Compliance • Auditability
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
