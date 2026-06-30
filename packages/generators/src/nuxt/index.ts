import { UINode } from '@codegen/shared';
import { Vue3Generator } from '../vue3/index.js';

export interface NuxtGeneratorOptions {
  /** 是否開啟自動導入。預設為 true，不寫入自訂元件的 import 語句。 */
  autoImport?: boolean;
}

/**
 * Nuxt 程式碼產生器。
 * 繼承自 Vue3Generator，底層基礎語法相同。
 * 針對 Nuxt 目錄結構與自動導入（Auto-imports）機制進行特化。
 */
export class NuxtGenerator extends Vue3Generator {
  override frameworkName = 'nuxt';
  private autoImport: boolean;

  constructor(options: NuxtGeneratorOptions = {}) {
    super();
    this.autoImport = options.autoImport ?? true;
  }

  /**
   * 覆寫自訂元件 import 判斷。
   * 若開啟 autoImport (預設)，則不寫入 import 語句。
   */
  protected override shouldImportCustomComponent(_tag: string, _importPath: string): boolean {
    return !this.autoImport;
  }

  /**
   * 覆寫建議的存放目錄。
   * 若是頁面元件 (type === 'page')，應放入 'pages' 目錄；其餘放入 'components' 目錄。
   */
  override getOutputDir(ast: UINode): string {
    if (ast.type === 'page') {
      return 'pages';
    }
    return 'components';
  }
}
