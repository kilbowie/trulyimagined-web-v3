import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.trulyimagined.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const routes = [
    '/',
    '/about',
    '/accessibility',
    '/privacy-policy',
    '/data-rights-retention',
    '/terms-of-service',
    '/cookie-notice',
    '/contact',
    '/security-trust',
  ];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'weekly' : 'monthly',
    priority: route === '/' ? 1 : 0.6,
  }));
}
