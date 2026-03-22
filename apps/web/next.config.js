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

module.exports = nextConfig;
