'use client';

import { useEffect, useState } from 'react';
import { notFound } from 'next/navigation';

export default function AuthDebugPage() {
  // Prevent access in production
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [results, setResults] = useState<any>({
    health: null,
    login: null,
    callback: null,
    session: null,
    envCheck: {
      domain: '✓ Set',
      clientId: '✓ Set',
      baseUrl: '✓ Set',
      audience: '✓ Set',
    },
  });
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    runTests();
  }, []);

  async function runTests() {
    setTesting(true);
    const newResults: any = { ...results };

    // Test health endpoint
    try {
      const healthRes = await fetch('/api/health');
      newResults.health = {
        status: healthRes.status,
        ok: healthRes.ok,
        data: await healthRes.json(),
      };
    } catch (error: any) {
      newResults.health = { error: error.message };
    }

    // Test login endpoint (HEAD request to avoid redirect)
    try {
      const loginRes = await fetch('/auth/login', {
        method: 'HEAD',
        redirect: 'manual',
      });
      newResults.login = {
        status: loginRes.status,
        statusText: loginRes.statusText,
        redirectsToAuth0:
          loginRes.status === 0 || loginRes.status === 302 || loginRes.status === 307,
      };
    } catch (error: any) {
      newResults.login = { error: error.message };
    }

    // Test session endpoint
    try {
      const sessionRes = await fetch('/auth/profile');
      newResults.session = {
        status: sessionRes.status,
        authenticated: sessionRes.status === 200,
        data: sessionRes.status === 200 ? await sessionRes.json() : null,
      };
    } catch (error: any) {
      newResults.session = { error: error.message };
    }

    setResults(newResults);
    setTesting(false);
  }

  function TestResult({ title, result }: { title: string; result: any }) {
    if (!result) return null;

    const isError = result.error || (result.status && result.status >= 400);
    const isSuccess = result.ok || result.status === 200 || result.redirectsToAuth0;

    return (
      <div className="border rounded-lg p-4 mb-4">
        <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
          {isSuccess && <span className="text-green-600">✅</span>}
          {isError && <span className="text-red-600">❌</span>}
          {!isSuccess && !isError && <span className="text-yellow-600">⚠️</span>}
          {title}
        </h3>
        <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">🔍 Auth0 Debug Dashboard</h1>
        <p className="text-gray-600 mb-8">
          Diagnostic information for authentication troubleshooting
        </p>

        {testing && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <p className="text-blue-700">⏳ Running tests...</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">📋 Environment Configuration</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600">Domain:</span>
              <span className="ml-2 font-mono text-sm">kilbowieconsulting.uk.auth0.com</span>
            </div>
            <div>
              <span className="text-gray-600">Client ID:</span>
              <span className="ml-2 font-mono text-sm">WBTni...AJ1e</span>
            </div>
            <div>
              <span className="text-gray-600">Base URL:</span>
              <span className="ml-2 font-mono text-sm">http://localhost:3000</span>
            </div>
            <div>
              <span className="text-gray-600">Audience:</span>
              <span className="ml-2 font-mono text-sm">https://api.trulyimagined.com</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">🧪 Endpoint Tests</h2>
          <TestResult title="Health Check (/api/health)" result={results.health} />
          <TestResult title="Login Endpoint (/auth/login)" result={results.login} />
          <TestResult title="Session Endpoint (/auth/profile)" result={results.session} />
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mb-6">
          <h2 className="text-xl font-bold mb-3">⚠️ Production App Sharing Warning</h2>
          <p className="mb-3">
            You mentioned that <strong>production is using the same Auth0 application</strong>.
          </p>
          <p className="mb-3">This can cause issues:</p>
          <ul className="list-disc ml-6 mb-3 space-y-1">
            <li>Callback URL conflicts between dev and production</li>
            <li>Session cookie conflicts if testing on same domain</li>
            <li>Different route structures (/auth vs /api/auth)</li>
            <li>Risk of accidentally affecting production users</li>
          </ul>
          <div className="bg-white p-4 rounded border border-yellow-300 mt-4">
            <h3 className="font-bold mb-2">✅ Recommended Solution:</h3>
            <ol className="list-decimal ml-6 space-y-2">
              <li>
                <strong>Create a new Auth0 Application for development:</strong>
                <ul className="list-disc ml-6 mt-1 text-sm">
                  <li>Name: "Truly Imagined - Development"</li>
                  <li>Type: Regular Web Application</li>
                  <li>Callback URLs: http://localhost:3000/api/auth/callback</li>
                  <li>Logout URLs: http://localhost:3000</li>
                </ul>
              </li>
              <li>
                <strong>Keep using the same API</strong> (https://api.trulyimagined.com) - APIs can
                be shared
              </li>
              <li>
                <strong>Update .env.local with new dev app credentials</strong>
              </li>
            </ol>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">🔧 Manual Tests</h2>
          <div className="space-y-3">
            <button
              onClick={runTests}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
              disabled={testing}
            >
              {testing ? 'Testing...' : '🔄 Re-run Tests'}
            </button>
            <a
              href="/auth/login"
              className="block text-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
            >
              🔐 Test Login Flow
            </a>
            <a
              href="/auth/profile"
              target="_blank"
              className="block text-center bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
            >
              👤 Check Session (opens in new tab)
            </a>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>After making changes, restart the dev server and refresh this page</p>
        </div>
      </div>
    </div>
  );
}
