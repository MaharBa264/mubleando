import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  transpilePackages: ['@mw/engine', '@mw/exporters'],
  reactStrictMode: true,
  // Monorepo: el adaptador de Cloudflare empaqueta la app con los paquetes de la raíz (motor, exportaciones).
  outputFileTracingRoot: path.join(__dirname, '../..'),
};

export default config;
