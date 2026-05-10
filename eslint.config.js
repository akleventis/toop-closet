import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tsParser from '@typescript-eslint/parser'
import { defineConfig, globalIgnores } from 'eslint/config'

const shared = {
  extends: [
    js.configs.recommended,
    reactHooks.configs.flat.recommended,
    reactRefresh.configs.vite,
  ],
  languageOptions: {
    globals: globals.browser,
  },
}

export default defineConfig([
  globalIgnores(['dist']),
  {
    ...shared,
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ...shared.languageOptions,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    ...shared,
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ...shared.languageOptions,
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': 'off', // TypeScript handles this via noUnusedLocals/noUnusedParameters
    },
  },
])
