import js from '@eslint/js';
import nodePlugin from 'eslint-plugin-n';
import importPlugin from 'eslint-plugin-import';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import prettierConfig from 'eslint-config-prettier';

export default [
  // Base JavaScript rules
  js.configs.recommended,

  // Global configuration
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        module: 'readonly',
        exports: 'readonly',
        require: 'readonly',
        // Jest globals for test files
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
      },
    },

    plugins: {
      n: nodePlugin,
      import: importPlugin,
      promise: promisePlugin,
      security: securityPlugin,
    },

    rules: {
      // ES6+ and modern JavaScript
      'prefer-const': 'error',
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'template-curly-spacing': ['error', 'never'],
      'object-shorthand': 'error',
      'prefer-destructuring': [
        'error',
        {
          array: false,
          object: true,
        },
      ],

      // Error prevention
      'no-console': 'off', // Allow console for logging
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-case-declarations': 'error',
      'no-unused-expressions': 'error',
      'no-unreachable': 'error',
      'no-duplicate-imports': 'error',

      // Code quality (relaxed for this project)
      complexity: ['warn', 15],
      'max-depth': ['warn', 5],
      'max-lines': ['warn', 600],
      'max-lines-per-function': ['warn', 150],
      'max-params': ['warn', 6],
      'max-statements': ['warn', 30],

      // Async/await best practices
      'require-await': 'warn',
      'no-async-promise-executor': 'error',
      'prefer-promise-reject-errors': 'error',
      'no-return-await': 'error',

      // Import rules
      'import/no-unresolved': 'error',
      'import/no-duplicates': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          'newlines-between': 'always',
        },
      ],
      'import/newline-after-import': 'error',
      'import/no-default-export': 'off',

      // Promise rules
      'promise/always-return': 'error',
      'promise/catch-or-return': 'error',
      'promise/param-names': 'error',
      'promise/no-nesting': 'warn',
      'promise/no-promise-in-callback': 'warn',
      'promise/no-callback-in-promise': 'warn',
      'promise/avoid-new': 'off',

      // Security rules (relaxed for config objects)
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error',

      // Node.js specific
      'n/no-deprecated-api': 'error',
      'n/no-missing-import': 'off', // Handled by import plugin
      'n/no-unpublished-import': 'off',
      'n/prefer-global/process': 'error',
      'n/prefer-global/buffer': 'error',
      'n/prefer-global/console': 'error',
      'n/prefer-global/url': 'error',
      'n/prefer-promises/fs': 'error',
    },
  },

  // Specific configuration for source files
  {
    files: ['src/**/*.js'],
    rules: {
      'no-console': 'off', // Allow console in logger utility
      'max-lines': ['warn', 600], // Larger files allowed in services
    },
  },

  // Specific configuration for test files
  {
    files: ['tests/**/*.js', '**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-console': 'off',
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-statements': 'off',
      complexity: 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },

  // Configuration files
  {
    files: ['*.config.js', 'config/**/*.js'],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-require': 'off',
    },
  },

  // Scripts directory
  {
    files: ['scripts/**/*.js'],
    rules: {
      'no-console': 'off',
      'n/no-process-exit': 'off',
      'security/detect-child-process': 'off',
    },
  },

  // Prettier integration (must be last)
  prettierConfig,

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'models/Xenova/**',
      'logs/**',
      'grafana/data/**',
      'prometheus/data/**',
      'postgres-data/**',
      'redis-data/**',
      '*.min.js',
    ],
  },
];
