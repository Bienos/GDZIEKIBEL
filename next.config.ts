import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Language lives in the route, so the bare domain has to pick one. Polish is
  // the default because the product is Warsaw-only and Polish-first. The
  // redirect is temporary, not permanent: locale negotiation may replace it
  // once there is more than a shell to serve.
  async redirects() {
    return [{ source: '/', destination: '/pl', permanent: false }];
  },
};

export default nextConfig;
