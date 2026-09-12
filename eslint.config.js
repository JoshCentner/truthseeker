// @ts-check
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      // Determinism discipline (research.md §2): the engine's only inputs are the
      // ledger's own fields. These built-ins are the two realistic ways a "pure"
      // function silently stops being pure.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'Date.now() is non-deterministic. The engine may only read fields supplied on the ledger.',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'new Date() with no arguments is non-deterministic. Read a timestamp field from the ledger instead.',
        },
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message: 'Math.random() is non-deterministic and forbidden anywhere in the engine core.',
        },
      ],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', 'tests/**'],
  },
];
