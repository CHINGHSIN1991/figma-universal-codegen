import { BaseGenerator, GenerateOptions, UINode } from '@codegen/shared';
import {
  resolveComponentTag,
  MappingConfig,
  StyleStrategy,
  TailwindStrategy,
  CssStrategy,
} from '@codegen/parser';

/** 模板縮排單位（兩個空格） */
const INDENT = '  ';

/**
 * Vue 3 SFC 程式碼產生器。
 *
 * 設計說明：
 * 沿用既有的兩個建構元件，而非自行重做：
 *   1. Style Engine（{@link TailwindStrategy} / {@link CssStrategy}）— 將 `node.styles`
 *      轉成 `class` 或 `style` 屬性字串，由 `options.styleMode` 決定。
 *   2. Component Resolver（{@link resolveComponentTag}）— 將圖層名稱映射為自訂元件或 HTML 標籤。
 *      若 Parser 已在 AST 上填好 `targetComponent`，則直接沿用（與 orchestrator 一致），
 *      避免重複解析。
 *
 * 透過遞迴巡覽 UINode 樹拼接 `<template>` 內容，同時收集自訂元件的 import，
 * 最後組裝成可直接寫入 `.vue` 檔的單一字串。
 */
export class Vue3Generator extends BaseGenerator {
  frameworkName = 'vue3';

  getFileExtension(): string {
    return '.vue';
  }

  /**
   * 判斷是否需要為自訂元件寫入 import 語句。預設皆需要。
   */
  protected shouldImportCustomComponent(_tag: string, _importPath: string): boolean {
    return true;
  }

  generateComponent(ast: UINode, options: GenerateOptions): string {
    // 依 --style 參數選擇樣式策略（Strategy Pattern 的實際切換點）
    const strategy: StyleStrategy =
      options.styleMode === 'tailwind' ? new TailwindStrategy() : new CssStrategy();

    // GenerateOptions.mappingConfig 對外型別為 Record<string, unknown>，
    // 這裡轉回 Component Resolver 期望的結構；未命中時 resolveComponentTag 會安全退回 HTML 標籤。
    const config = options.mappingConfig as unknown as MappingConfig;

    // 收集自訂元件 import（以 tag 為 key 去重）
    const imports = new Map<string, string>();

    // 將樣式 Token 轉成標籤屬性：tailwind → class，css → style；空字串則不輸出屬性
    const styleAttr = (node: UINode): string => {
      const styleString = strategy.parse(node.styles);
      if (!styleString) return '';
      const attr = options.styleMode === 'tailwind' ? 'class' : 'style';
      return ` ${attr}="${styleString}"`;
    };

    // 決定節點最終標籤：優先沿用 Parser 已解析的映射，否則即時查詢 mapping config
    const resolveTag = (node: UINode) => {
      if (node.targetComponent) {
        return {
          tag: node.targetComponent,
          isCustomComponent: true,
          importPath: node.importPath ?? null,
        };
      }
      return resolveComponentTag(node.name, this.frameworkName, config);
    };

    // 遞迴函式：將單一 UINode 轉為帶縮排的 Vue Template 字串
    const buildTemplate = (node: UINode, depth: number): string => {
      const pad = INDENT.repeat(depth);
      const resolved = resolveTag(node);

      if (resolved.isCustomComponent && resolved.importPath) {
        if (this.shouldImportCustomComponent(resolved.tag, resolved.importPath)) {
          imports.set(resolved.tag, resolved.importPath);
        }
      }

      const attrs = styleAttr(node);
      const text = escapeText(node.textContents ?? '');
      const children = node.children.map((child) => buildTemplate(child, depth + 1));

      // 無文字也無子節點 → 自閉合標籤
      if (!text && children.length === 0) {
        return `${pad}<${resolved.tag}${attrs} />`;
      }

      // 純文字節點（無子節點）→ 單行
      if (text && children.length === 0) {
        return `${pad}<${resolved.tag}${attrs}>${text}</${resolved.tag}>`;
      }

      // 含子節點 → 多行縮排（文字內容置於子節點之前）
      const childPad = INDENT.repeat(depth + 1);
      const inner = [text ? `${childPad}${text}` : '', ...children].filter(Boolean).join('\n');
      return `${pad}<${resolved.tag}${attrs}>\n${inner}\n${pad}</${resolved.tag}>`;
    };

    const templateContent = buildTemplate(ast, 1);

    // 有收集到 import 才輸出 <script setup> 區塊（import 的元件在 template 中自動可用）
    const scriptBlock =
      imports.size > 0
        ? `<script setup lang="ts">\n` +
          Array.from(imports, ([tag, path]) => `import ${tag} from '${path}';`).join('\n') +
          `\n</script>\n\n`
        : '';

    // 組裝成 Vue 3 SFC 格式
    return `${scriptBlock}<template>\n${templateContent}\n</template>\n`;
  }
}

// 對文字內容做最小化 HTML 轉義，避免設計稿文字（含 < > & 或 Vue 的 {{ }}）破壞模板結構。
function escapeText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{\{/g, '&#123;&#123;');
}
