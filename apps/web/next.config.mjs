import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export default {
  reactStrictMode: true,
  outputFileTracingRoot: root,
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        source: '/maps/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/maps/:path*',
        has: [{ type: 'query', key: 'v', value: '.+' }],
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};
