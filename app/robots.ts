import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/sign-in/', '/sign-up/', '/success/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
