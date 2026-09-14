import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
      // MapLibre's own minified worker, copied in by scripts/map/copy-maplibre-worker.ts.
      'public/maplibre-gl/**',
    ],
  },
  ...coreWebVitals,
  ...typescriptConfig,
];

export default config;
