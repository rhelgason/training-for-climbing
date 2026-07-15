import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @tfc/core ships raw TypeScript (no build step); Next must transpile it.
  transpilePackages: ['@tfc/core'],
  reactStrictMode: true,
};

export default nextConfig;
