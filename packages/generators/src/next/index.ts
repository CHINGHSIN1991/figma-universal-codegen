import { GenerateOptions, UINode } from '@codegen/shared';
import { ReactGenerator, toComponentName } from '../react/index.js';

/** Next.js Client Component 指令；必須位於檔案最頂端（先於所有 import）。 */
const USE_CLIENT_DIRECTIVE = `'use client';`;

/**
 * Next.js 程式碼產生器。
 * 繼承自 {@link ReactGenerator}，底層 JSX/TSX 語法完全相同，
 * 額外注入 Next.js App Router 的兩項專屬規則：
 *
 *   1. Client Component 標記：若 AST 樹中任一節點帶有客戶端互動
 *      （`hasClickEvent === true`），整個元件即無法作為 React Server Component，
 *      於是在檔案最頂端強制注入 `'use client';`。
 *   2. 檔案路由命名：`type === 'page'` 的節點固定輸出為 `page.tsx`，
 *      以對應 App Router 的檔案約定。
 */
export class NextGenerator extends ReactGenerator {
  override frameworkName = 'next';

  override generateComponent(ast: UINode, options: GenerateOptions): string {
    const code = super.generateComponent(ast, options);

    // 互動性偵測：整棵樹只要有任一節點帶 hasClickEvent，就標記為 Client Component。
    // 註：此處用 'use client'（客戶端元件指令），而非 runtime='edge'（後者是 route
    // segment 的執行環境設定，與「是否含客戶端互動」無關）。
    if (hasInteraction(ast)) {
      return `${USE_CLIENT_DIRECTIVE}\n\n${code}`;
    }
    return code;
  }

  /**
   * 覆寫檔名規則以對應 App Router：
   * 頁面節點固定輸出為 `page.tsx`；其餘元件沿用 PascalCase 元件名稱命名。
   */
  override getFileName(ast: UINode): string {
    if (ast.type === 'page') {
      return `page${this.getFileExtension()}`;
    }
    return `${toComponentName(ast.name)}${this.getFileExtension()}`;
  }
}

// 遞迴判斷整棵樹是否含任何客戶端互動節點。
function hasInteraction(node: UINode): boolean {
  if (node.hasClickEvent) return true;
  return node.children.some(hasInteraction);
}
