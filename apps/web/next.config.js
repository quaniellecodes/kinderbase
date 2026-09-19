/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.CAPACITOR_BUILD === 'true' ? 'export' : undefined,
  trailingSlash: true,
  images: {
    unoptimized: process.env.CAPACITOR_BUILD === 'true',
  },
  serverExternalPackages: ['@react-pdf/renderer'],
};

module.exports = nextConfig;
