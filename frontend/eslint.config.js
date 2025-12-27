import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';

import noCommentsPlugin from './eslint-plugin-no-comments.js';

export default defineConfig([
  /* =====================================================
   * IGNORE PATHS
   * ===================================================== */
  {
    ignores: ['dist/**', 'node_modules/**', '*.config.js', 'eslint-plugin-no-comments.js'],
  },

  /* =====================================================
   * BASE JS (eslint:recommended em flat config)
   * ===================================================== */
  js.configs.recommended,

  /* =====================================================
   * REACT / JSX
   * ===================================================== */
  {
    files: ['**/*.{js,jsx}'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier,
      'no-comments': noCommentsPlugin,
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      /* =====================================================
       * ❌ FORMATAÇÃO — ESLINT NÃO OPINA
       * (PRETTIER É O DONO)
       * ===================================================== */
      indent: 'off',
      'react/jsx-indent': 'off',
      'react/jsx-indent-props': 'off',

      /* =====================================================
       * PRETTIER (FORMATAÇÃO REAL)
       * ===================================================== */
      'prettier/prettier': 'error',

      /* =====================================================
       * REACT / JSX
       * ===================================================== */
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      /* =====================================================
       * REACT HOOKS
       * ===================================================== */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /* =====================================================
       * REACT REFRESH
       * ===================================================== */
      'react-refresh/only-export-components': 'off',

      /* =====================================================
       * CUSTOM RULES
       * ===================================================== */
      'no-comments/no-explanatory-comments': 'warn',
      'no-comments/no-empty-blocks': 'warn',

      /* =====================================================
       * AJUSTES PRÁTICOS
       * ===================================================== */
      'no-unused-vars': 'off',
    },
  },
]);
