import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['forest-rock-reception-begun.trycloudflare.com'],
  poweredByHeader: false,
  transpilePackages: ['@arqueia/contracts', '@arqueia/ui'],
};

export default nextConfig;
