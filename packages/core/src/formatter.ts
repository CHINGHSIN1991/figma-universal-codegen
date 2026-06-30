import prettier from 'prettier';

/**
 * 在將程式碼寫入磁碟前，於記憶體中透過 Prettier API 排版。
 *
 * 設計要點：
 * - `filepath` 不需要真實存在，Prettier 只用它的副檔名推導解析器
 *   （`.vue` → vue parser、`.tsx` → typescript parser、`.ts` → typescript parser）。
 * - 先讀取專案根目錄的 `.prettierrc` 設定，確保輸出格式與專案風格一致。
 * - 排版失敗時不中斷流程，改以 `console.warn` 示警並回傳原始字串，
 *   讓整條 pipeline 仍能產出可用的程式碼。
 *
 * @param rawCode  - 拼接出的原始程式碼字串（縮排可能不一致）
 * @param filepath - 帶有副檔名的虛擬路徑（例如 `Button.vue`、`Button.tsx`）
 * @returns 排版完成的程式碼字串
 */
export async function formatCode(rawCode: string, filepath: string): Promise<string> {
  try {
    // 自動根據副檔名（.vue / .tsx）尋找對應的解析器
    const config = await prettier.resolveConfig(process.cwd());
    return await prettier.format(rawCode, {
      ...config,
      filepath, // 傳入 filepath 讓 Prettier 知道該用 typescript 還是 vue parser
      semi: true,
      singleQuote: true,
      tabWidth: 2,
    });
  } catch (error) {
    console.warn('[⚠️ Formatter 警告] Prettier 排版失敗，輸出原始程式碼。', error);
    return rawCode;
  }
}
