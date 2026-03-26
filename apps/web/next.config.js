const { withSentryConfig } = require('@sentry/nextjs');

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

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppresses all logs in development
  silent: process.env.NODE_ENV !== 'production',
  
  // Organization and project for source maps upload
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Auth token for uploading source maps
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Automatically tree-shake Sentry logger statements for reduced bundle size
  disableLogger: true,
  
  // Hides source maps from generated client bundles (security)
  hideSourceMaps: true,
  
  // Upload sourcemaps during build (only in production)
  widenClientFileUpload: true,
  
  // Disable CLI telemetry
  telemetry: false,
};

// Wrap next config with Sentry
module.exports = process.env.SENTRY_ENABLED === 'false'
  ? nextConfig
  : withSentryConfig(nextConfig, sentryWebpackPluginOptions);

