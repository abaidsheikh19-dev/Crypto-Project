/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Native / server-only packages stay out of the bundle.
  serverExternalPackages: ['@node-rs/argon2', '@prisma/client', 'embedded-postgres'],
  experimental: {
    serverActions: {
      // Forms are small; keep request bodies tight.
      bodySizeLimit: '100kb',
    },
  },
};

export default nextConfig;
