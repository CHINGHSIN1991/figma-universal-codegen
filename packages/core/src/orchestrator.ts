/**
 * Orchestrator（統合器）
 *
 * 負責將三條流水線串接成一條：
 *   1. UINode AST  ← 已由 Parser 清洗完畢
 *   2. StyleStrategy（Tailwind / CSS）← 根據 CLI 參數決定
 *   3. ComponentResolver（元件映射）  ← 讀取 mapping.config.json
 *
 * compile() 遞迴巡覽整棵 UINode 樹，對每個節點輸出
 * 「最終標籤」與「樣式字串」，作為後續程式碼生成的輸入資料。
 */

import { UINode } from '@codegen/shared';
import {
  StyleStrategy,
  TailwindStrategy,
  CssStrategy,
  resolveComponentTag,
  MappingConfig,
} from '@codegen/parser';

// ─── 公開型別 ─────────────────────────────────────────────────────────────────

export type StyleMode = 'tailwind' | 'css';

export interface OrchestratorOptions {
  /** 目標框架，對應 mapping.config.json 的 key（例如 "vue3" | "react"） */
  framework: string;
  /** 樣式輸出模式，對應 CLI 的 --style 參數 */
  styleMode: StyleMode;
  /** 從 mapping.config.json 讀入的設定物件 */
  config: MappingConfig;
}

/** compile() 對每個節點輸出的結果 */
export interface CompiledNode {
  /** 最終要渲染的標籤或元件名稱（例如 "BaseButton" 或 "div"） */
  tag: string;
  /** 是否為 mapping.config.json 中定義的自訂元件 */
  isCustomComponent: boolean;
  /** 元件 import 路徑；HTML 原生標籤時為 null */
  importPath: string | null;
  /** 由 StyleStrategy 產生的樣式字串（className 或 inline-style） */
  styleString: string;
  /** 文字節點的純文字內容 */
  textContents?: string;
  /** 遞迴編譯後的子節點 */
  children: CompiledNode[];
}

// ─── 核心函式 ─────────────────────────────────────────────────────────────────

/**
 * 遞迴編譯單一 UINode 及其子樹。
 *
 * @param node     - 已清洗的 UINode（來自 Parser）
 * @param strategy - 樣式轉譯策略（TailwindStrategy 或 CssStrategy）
 * @param options  - 框架與 mapping config 設定
 */
export function compile(
  node: UINode,
  strategy: StyleStrategy,
  options: OrchestratorOptions,
): CompiledNode {
  // 1. 樣式轉譯：UIStyleToken → 樣式字串
  const styleString = strategy.parse(node.styles);

  // 2. 元件解析：若 Parser 已命中 mapping，直接沿用其結果；
  //    否則再透過 ComponentResolver 查詢（向後相容未傳 config 的舊呼叫）。
  const resolved = node.targetComponent
    ? {
        isCustomComponent: true,
        tag: node.targetComponent,
        importPath: node.importPath ?? null,
      }
    : resolveComponentTag(node.name, options.framework, options.config);

  console.log(
    `[Compile] 標籤: <${resolved.tag}>` +
      (resolved.isCustomComponent ? ` (自訂元件，import: ${resolved.importPath})` : ' (HTML)') +
      `, 樣式: "${styleString}"`,
  );

  return {
    tag: resolved.tag,
    isCustomComponent: resolved.isCustomComponent,
    importPath: resolved.importPath,
    styleString,
    textContents: node.textContents,
    // 遞迴編譯子節點
    children: node.children.map((child) => compile(child, strategy, options)),
  };
}

/**
 * Orchestrator 進入點：選擇 StyleStrategy 並啟動整棵樹的遞迴編譯。
 *
 * @param rootNode - Parser 回傳的 UINode 根節點
 * @param options  - 執行選項（framework、styleMode、config）
 * @returns 編譯完成的節點樹（CompiledNode）
 */
export function orchestrate(rootNode: UINode, options: OrchestratorOptions): CompiledNode {
  // 依據 --style 參數決定策略（Strategy Pattern 實際切換點）
  const strategy: StyleStrategy =
    options.styleMode === 'tailwind' ? new TailwindStrategy() : new CssStrategy();

  console.log(
    `[Orchestrator] 啟動，框架: ${options.framework}，樣式模式: ${options.styleMode}`,
  );

  return compile(rootNode, strategy, options);
}
