import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'tgnrqry5tpxb5imfstlqu2mdqpm3zwmmaxrrakjxuinvpwhkanca.arweave.net',
      },
      {
        protocol: 'https',
        hostname: 'gateway.irys.xyz',
      },
    ],
  },
};

export default nextConfig;
