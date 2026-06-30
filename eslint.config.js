// @ts-check
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // ── 忽略的目錄 ────────────────────────────────────────────────────────────
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/*.js.map'],
  },

  // ── TypeScript 原始碼規則 ──────────────────────────────────────────────────
  {
    files: ['packages/**/src/**/*.ts'],
    extends: [
      ...tseslint.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // ── 死代碼偵測（防止重複 import 與未使用變數汙染產出）──────────────────
      // 關掉基礎版，改用 TS 版（能辨識型別宣告）
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],

      // 禁止重複 import（防止產生器拼接時意外插入重複的 import 宣告）
      'no-duplicate-imports': 'error',

      // 禁止宣告了但永遠不用的表達式
      '@typescript-eslint/no-unused-expressions': 'error',

      // ── 產出代碼品質 ────────────────────────────────────────────────────────
      // 禁止 any（產生器輸出要有型別）
      '@typescript-eslint/no-explicit-any': 'warn',

      // 非同步函式必須 await（防止忘記 await pipeline 中的非同步步驟）
      '@typescript-eslint/require-await': 'warn',
    },
  },

  // ── 關掉與 Prettier 衝突的格式規則（永遠放最後）─────────────────────────
  prettierConfig,
);
