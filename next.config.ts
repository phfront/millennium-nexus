import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@phfront/millennium-ui'],
  async rewrites() {
    return [
      {
        source: '/supabase-api/:path*',
        destination: '/api/supabase/:path*',
      },
    ];
  },
  async redirects() {
    return [
      { source: '/daily-goals', destination: '/habits-goals', permanent: true },
      { source: '/daily-goals/:path*', destination: '/habits-goals/:path*', permanent: true },
    ];
  },
};

export default nextConfig;
