import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import importX from 'eslint-plugin-import-x';
import tseslint from 'typescript-eslint';

const MODULE_LEVEL_CONSTANT_VALUES = [
  'NewExpression[callee.name=/^(Set|Map)$/][arguments.length>0]',
  'Literal',
  'ArrayExpression[elements.length>0]',
  'TSAsExpression > ArrayExpression[elements.length>0]',
];

export default defineConfig([
  {
    ignores: [
      '.claude/**',
      '**/node_modules/**',
      '**/dist/**',
      'corpus-report/**',
      '**/third_party/**',
      'packages/twig-eslint-parser/src/es-html-parser/**',
      'packages/twig-eslint-parser/src/lexer/**',
    ],
  },
  {
    files: ['**/*.{js,ts}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    plugins: { '@stylistic': stylistic, 'import-x': importX },
    languageOptions: { globals: globals.node },
    rules: {
      '@stylistic/indent': ['warn', 2],
      '@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],
      '@stylistic/semi': ['warn', 'always'],
      '@stylistic/keyword-spacing': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'warn',
      '@typescript-eslint/no-shadow': 'warn',
      'import-x/consistent-type-specifier-style': ['warn', 'prefer-top-level'],
      'import-x/no-duplicates': 'warn',
      'import-x/order': ['warn', {
        'groups': ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
        'newlines-between': 'never',
      }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-shadow': 'off',
      'no-restricted-syntax': ['warn', ...MODULE_LEVEL_CONSTANT_VALUES.map((value) => ({
        selector: `:matches(Program, ExportNamedDeclaration) > VariableDeclaration[kind='const'] > VariableDeclarator[id.name=/^[a-z]/] > ${value}`,
        message: 'A module-level constant is SCREAMING_SNAKE_CASE.',
      }))],
    },
  },
  {
    files: ['tools/**/*.ts', 'packages/*/scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
]);
