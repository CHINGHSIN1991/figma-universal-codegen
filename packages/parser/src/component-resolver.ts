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

// ─── 框架 fallback ────────────────────────────────────────────────────────────

/**
 * 衍生框架的映射退回鏈：mapping.config.json 未定義該框架的 importPath 時，
 * 改用其基底框架的設定（Next 的元件寫法同 React、Nuxt 同 Vue 3）。
 */
const FRAMEWORK_FALLBACK: Record<string, string> = {
  next: 'react',
  nuxt: 'vue3',
};

/** 依「目標框架 → 基底框架」順序找出第一個有定義的 framework mapping。 */
function findFrameworkMapping(
  match: ComponentMapping,
  framework: string,
): FrameworkMapping | undefined {
  const direct = match[framework];
  if (typeof direct === 'object') return direct;

  const fallback = FRAMEWORK_FALLBACK[framework];
  const inherited = fallback ? match[fallback] : undefined;
  return typeof inherited === 'object' ? inherited : undefined;
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
    const frameworkMapping = findFrameworkMapping(match, framework);
    if (frameworkMapping) {
      return {
        isCustomComponent: true,
        tag: match.targetComponent,
        importPath: frameworkMapping.importPath,
      };
    }
    // 命中名稱但該框架（含基底框架）皆無 importPath：
    // 產出沒有 import 的自訂元件標籤會是壞程式碼，故示警並退回 HTML 標籤。
    console.warn(
      `[Resolver 警告] "${nodeName}" 命中 mapping，但框架 "${framework}" 未定義 importPath，退回 HTML 標籤。`,
    );
  }

  // 若沒命中任何既有元件，則退回最基礎的 HTML 語意標籤
  return {
    isCustomComponent: false,
    tag: nodeName.toLowerCase().includes('text') ? 'span' : 'div',
    importPath: null,
  };
}
