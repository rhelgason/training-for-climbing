import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @tfc/core ships raw TypeScript (no build step); Next must transpile it.
  transpilePackages: ['@tfc/core'],
  reactStrictMode: true,
  // Lint runs as its own CI step (`npm run lint`), so builds aren't gated on it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
