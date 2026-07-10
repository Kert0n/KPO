import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      '.vitepress/cache/**',
      '.vitepress/dist/**',
      'output/**',
      'test-results/**',
      'analysis/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{ts,vue,mts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      globals: { ...globals.browser },
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/no-v-html': 'off'
    }
  },
  {
    files: ['.vitepress/theme/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } }
  },
  {
    files: ['**/*.mjs', '**/*.mts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    files: ['**/__tests__/**', 'tests/**'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' }
  },
  {
    files: ['.vitepress/theme/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../../lib/**', '../../../lib/**'],
              message: 'Theme must depend on shared modules, not build-time lib modules.'
            }
          ]
        }
      ]
    }
  }
)
