import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/sign-in/', '/sign-up/', '/success/'],
    },
    sitemap: 'https://virareelai.com/sitemap.xml',
  };
}
