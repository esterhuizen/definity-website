const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    // Next.js's dev-mode React Refresh runtime evaluates strings as JS for HMR,
    // which requires 'unsafe-eval'. Production builds don't include the refresh
    // runtime, so we keep the production CSP strict and only relax in dev.
    const isDev = process.env.NODE_ENV !== 'production';
    const scriptSrc = [
      "'self'",
      "'unsafe-inline'",
      isDev ? "'unsafe-eval'" : null,
      'https://embed.typeform.com',
    ].filter(Boolean).join(' ');

    const csp = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-src https://app.sanctum.so https://*.sanctum.so https://jup.ag https://*.jup.ag https://*.typeform.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
