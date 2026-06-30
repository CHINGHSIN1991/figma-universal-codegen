import { BaseGenerator, GenerateOptions, UINode } from '@codegen/shared';
import {
  resolveComponentTag,
  MappingConfig,
  StyleStrategy,
  TailwindStrategy,
  CssStrategy,
} from '@codegen/parser';

/** JSX 縮排單位（兩個空格） */
const INDENT = '  ';

/**
 * React TSX 程式碼產生器。
 *
 * 設計說明：
 * 與 {@link Vue3Generator} 共用同一套建構元件（Style Engine + Component Resolver），
 * 但針對 React/JSX 的語法差異做三點特化：
 *   1. 樣式屬性用 `className`（而非 `class`）；css 模式輸出 React 的 inline style
 *      物件 `style={{ ... }}`（而非字串），由 {@link CssStrategy} 的輸出轉換而來。
 *   2. 文字內容依 JSX 規則轉義（`< > & { }` 皆為特殊字元）。
 *   3. 整體包成具名函數元件 `export function Xxx() { return (...) }`。
 *
 * 透過遞迴巡覽 UINode 樹拼接 JSX 字串，同時收集自訂元件的 import。
 */
export class ReactGenerator extends BaseGenerator {
  frameworkName = 'react';

  getFileExtension(): string {
    return '.tsx';
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

    // 將樣式 Token 轉成 JSX 屬性：tailwind → className，css → style={{...}}；無樣式則不輸出屬性
    const styleAttr = (node: UINode): string => {
      const styleString = strategy.parse(node.styles);
      if (!styleString) return '';
      if (options.styleMode === 'tailwind') {
        return ` className="${styleString}"`;
      }
      return ` style={{ ${cssStringToReactStyle(styleString)} }}`;
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

    // 遞迴函式：將單一 UINode 轉為帶縮排的 JSX 字串
    const buildJSX = (node: UINode, depth: number): string => {
      const pad = INDENT.repeat(depth);
      const resolved = resolveTag(node);

      if (resolved.isCustomComponent && resolved.importPath) {
        imports.set(resolved.tag, resolved.importPath);
      }

      const attrs = styleAttr(node);
      const text = escapeJsxText(node.textContents ?? '');
      const children = node.children.map((child) => buildJSX(child, depth + 1));

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

    // 根節點 JSX 從 depth 2 起算（位於 `return (` 之下一層縮排）
    const bodyJSX = buildJSX(ast, 2);

    const componentName = toComponentName(ast.name);

    // 自訂元件採具名 import；React 執行階段引入固定置頂
    const customImports = Array.from(
      imports,
      ([tag, path]) => `import { ${tag} } from '${path}';`,
    ).join('\n');
    const importBlock = `import React from 'react';` + (customImports ? `\n${customImports}` : '');

    // 拼裝成標準的 React 具名函數元件
    return (
      `${importBlock}\n\n` +
      `export function ${componentName}() {\n` +
      `${INDENT}return (\n` +
      `${bodyJSX}\n` +
      `${INDENT});\n` +
      `}\n`
    );
  }
}

// 將 ast.name 正規化為合法的 React 元件識別字（PascalCase）。
// 例："Home Page" → "HomePage"、"submit-button" → "SubmitButton"；
// 空字串或非字母開頭則退回 "GeneratedComponent"。
export function toComponentName(name: string): string {
  const pascal = name
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return /^[A-Za-z]/.test(pascal) ? pascal : 'GeneratedComponent';
}

// 將 CssStrategy 產出的 CSS 宣告字串（"font-size: 24px; display: flex;"）
// 轉成 React inline style 物件的內容（"fontSize: '24px', display: 'flex'"）。
function cssStringToReactStyle(css: string): string {
  return css
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':');
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      return `${camel}: '${value}'`;
    })
    .join(', ');
}

// 依 JSX 規則轉義文字內容：避免設計稿文字含 < > & { } 破壞 JSX 結構。
// （`{`/`}` 在 JSX 文字中分別會啟動／結束運算式，故一併轉為 HTML 實體。）
function escapeJsxText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}
