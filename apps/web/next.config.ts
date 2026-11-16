import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@mw/engine', '@mw/exporters'],
  reactStrictMode: true,
};

export default config;
