/**
 * Component Resolver（元件解析器）
 *
 * 職責：在遞迴巡覽 UINode 樹時，判斷某個節點是否命中 mapping.config.json 的映射規則。
 * 若命中，回傳對應的自訂元件名稱與 import 路徑；
 * 若未命中，退回最基礎的 HTML 語意標籤（`div` 或 `span`）。
 */

// ─── Config 型別（對應 mapping.config.json 的結構）────────────────────────────

interface FrameworkMapping {
  importPath: string;
}

interface ComponentMapping {
  targetComponent: string;
  [framework: string]: string | FrameworkMapping;
}

export interface MappingConfig {
  mappings: Record<string, ComponentMapping>;
}

// ─── 回傳型別 ─────────────────────────────────────────────────────────────────

export interface ResolvedComponent {
  /** 是否命中 mapping.config.json 中的自訂元件規則 */
  isCustomComponent: boolean;
  /** 最終要渲染的標籤或元件名稱（例如 `BaseButton` 或 `div`） */
  tag: string;
  /** 元件的 import 路徑；HTML 原生標籤時為 null */
  importPath: string | null;
}

// ─── 主函式 ───────────────────────────────────────────────────────────────────

/**
 * 根據節點名稱與目標框架，從 mapping config 中解析出應使用的元件。
 *
 * @param nodeName  - Figma 圖層名稱（對應 UINode.name，例如 "PrimaryButton"）
 * @param framework - 目標框架（例如 "vue3" | "react"）
 * @param config    - 從 mapping.config.json 讀入的設定物件
 *
 * @example
 * // 命中規則：
 * resolveComponentTag('PrimaryButton', 'react', config)
 * // → { isCustomComponent: true, tag: 'BaseButton', importPath: '@/components/ui/button' }
 *
 * @example
 * // 未命中規則，退回 HTML 原生標籤：
 * resolveComponentTag('HeroSection', 'react', config)
 * // → { isCustomComponent: false, tag: 'div', importPath: null }
 */
export function resolveComponentTag(
  nodeName: string,
  framework: string,
  config: MappingConfig,
): ResolvedComponent {
  const match = config.mappings[nodeName];

  if (match) {
    const frameworkMapping = match[framework] as FrameworkMapping | undefined;
    return {
      isCustomComponent: true,
      tag: match.targetComponent,
      importPath: frameworkMapping?.importPath ?? null,
    };
  }

  // 若沒命中任何既有元件，則退回最基礎的 HTML 語意標籤
  return {
    isCustomComponent: false,
    tag: nodeName.toLowerCase().includes('text') ? 'span' : 'div',
    importPath: null,
  };
}
