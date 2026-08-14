import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@arqueia/contracts', '@arqueia/ui'],
};

export default nextConfig;
