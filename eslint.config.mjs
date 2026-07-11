import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.vitepress/cache/**',
      '.vitepress/dist/**',
      'analysis/**',
      'coverage/**',
      'node_modules/**',
      'output/**',
      'playwright-report/**',
      'test-results/**',
      'tests/characterization/__screenshots__/**',
      'tests/characterization/__snapshots__/**'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.{js,mjs,ts,mts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue']
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'vue/attributes-order': 'off',
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['.vitepress/theme/components/MermaidDiagram.vue'],
    rules: {
      'vue/no-v-html': 'off'
    }
  },
  prettier
)
