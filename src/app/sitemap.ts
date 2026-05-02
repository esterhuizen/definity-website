import type { MetadataRoute } from 'next';
import { SITE } from '@/config/pool';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['', '/faq', '/validators', '/addresses'].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: path === '' ? 1 : 0.6,
  }));
}
