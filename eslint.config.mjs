import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ['scripts/**/*.{ts,mjs}'],
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      parserOptions: {
        projectService: false,
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    files: ['packages/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/**'],
              message: 'Packages must not import app-private source.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/**'],
              message: 'Scripts must not import app-private source.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/api/**', '@shop/api', '@shop/api/**'],
              message: 'Web must use API contracts, never API source.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/contracts/**/*.{ts,tsx,mts,cts,js,mjs,cjs}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/**', '@shop/catalog', '@shop/catalog/**'],
              message: 'Contracts own transport schemas only; do not import catalog or app source.',
            },
          ],
        },
      ],
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.config.*', '.claude/skills/**'],
  },
);
