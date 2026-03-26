/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  transpilePackages: ['@trulyimagined/types', '@trulyimagined/utils', '@trulyimagined/middleware'],
  env: {
    AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
    AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID,
    API_GATEWAY_URL: process.env.API_GATEWAY_URL,
  },
};

// Check if Sentry is enabled and available
const SENTRY_ENABLED = process.env.SENTRY_ENABLED !== 'false';
let sentryEnabled = false;

if (SENTRY_ENABLED) {
  try {
    // Try to load Sentry module
    require.resolve('@sentry/nextjs');
    sentryEnabled = true;
  } catch (e) {
    console.warn('[next.config.js] Sentry module not found. Skipping Sentry integration.');
    console.warn('[next.config.js] Run "pnpm add @sentry/nextjs" in apps/web to enable Sentry.');
  }
}

// Export config with or without Sentry
if (sentryEnabled) {
  const { withSentryConfig } = require('@sentry/nextjs');

  // Sentry configuration options
  const sentryWebpackPluginOptions = {
    // Organization and project for source maps upload
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,

    // Auth token for uploading source maps
    authToken: process.env.SENTRY_AUTH_TOKEN,

    // Upload wider set of client source files for better stack trace resolution
    widenClientFileUpload: true,

    // Create a proxy API route to bypass ad-blockers (requests go to /monitoring instead of sentry.io)
    tunnelRoute: '/monitoring',

    // Suppress non-CI output (show logs in CI for debugging)
    silent: !process.env.CI,

    // Automatically tree-shake Sentry logger statements for reduced bundle size
    disableLogger: true,

    // Hides source maps from generated client bundles (security)
    hideSourceMaps: true,

    // Disable CLI telemetry
    telemetry: false,
  };

  module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
} else {
  module.exports = nextConfig;
}
