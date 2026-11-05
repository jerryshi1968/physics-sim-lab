import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  { ignores: ['artifacts/**', 'node_modules/**', '.npm-cache/**', 'dist/**', 'test-results/**', 'playwright-report/**', '.playwright-browsers/**'] },
  js.configs.recommended,
  { files: ['**/*.mjs', 'vite.config.ts', 'playwright.config.ts', 'tests/e2e/**/*.ts'], languageOptions: { globals: globals.node } },
  ...tseslint.configs.recommended.map(config => ({ ...config, files: ['**/*.ts', '**/*.tsx'] })),
  { files: ['src/app/**/*.tsx'], languageOptions: { globals: globals.browser }, plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules },
]);
