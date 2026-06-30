import { UINode } from './index.js';

export interface GenerateOptions {
  /** 樣式輸出模式，對應 CLI 的 --style 參數 */
  styleMode: 'tailwind' | 'css';
  /** 從 mapping.config.json 讀入的元件映射設定 */
  mappingConfig: Record<string, unknown>;
}

/**
 * 所有框架產生器的抽象基底類別。
 *
 * 設計目的：
 * 控制中心（CLI Core）不需要知道當前要產出的是 React 還是 Vue，
 * 只需要呼叫 `.generateComponent()`，收到的就一定是可直接寫入檔案的純文字字串。
 * 未來新增框架（例如 Svelte）只需繼承此類別並實作三個抽象成員即可。
 *
 * @example
 * class Vue3Generator extends BaseGenerator {
 *   frameworkName = 'vue3';
 *   generateComponent(ast, options) { ... }
 *   getFileExtension() { return '.vue'; }
 * }
 */
export abstract class BaseGenerator {
  /** 框架識別名稱，對應 mapping.config.json 的 key（例如 "vue3" | "react"） */
  abstract frameworkName: string;

  /** 將 UINode AST 轉譯成該框架的元件程式碼字串 */
  abstract generateComponent(ast: UINode, options: GenerateOptions): string;

  /** 回傳該框架的檔案副檔名（例如 ".vue"、".tsx"） */
  abstract getFileExtension(): string;

  /** 回傳該元件建議的存放目錄（例如 "components"、"pages"）。預設回傳 "components" */
  getOutputDir(ast: UINode): string {
    return 'components';
  }

  /**
   * 回傳該元件的輸出檔名（含副檔名）。
   * 預設為「圖層名稱 + 副檔名」；框架可覆寫以套用專屬命名規則
   * （例如 Next.js App Router 將頁面強制命名為 page.tsx）。
   */
  getFileName(ast: UINode): string {
    return `${ast.name}${this.getFileExtension()}`;
  }
}
