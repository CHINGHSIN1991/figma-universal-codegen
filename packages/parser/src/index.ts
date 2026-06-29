import { UINode, UIElementType, UIStyleToken, FigmaNode } from '@codegen/shared';
import { fetchFigmaNodes } from './figma-api.js';

export { fetchFigmaNodes };

/**
 * Parser 的公開進入點：抓取指定 Figma 節點並清洗成 UINode。
 * 等於 fetchFigmaNodes（取得 + Zod 驗證）→ transformToUINode（清洗）。
 */
export async function parseFigmaNode(
  fileKey: string,
  nodeId: string,
  token: string,
): Promise<UINode> {
  const document = await fetchFigmaNodes(fileKey, nodeId, token);
  return transformToUINode(document);
}

/**
 * 遞迴解析器核心：把 Figma 的 raw document tree 過濾／清洗成我們的通用 UINode。
 * 只取出我們需要的欄位，丟掉 miterLimit、scrollBehavior 等渲染雜訊。
 */
export function transformToUINode(figmaNode: FigmaNode): UINode {
  // 1. 基本型別對應
  let type: UIElementType = 'container';
  if (figmaNode.type === 'TEXT') type = 'text';
  if (figmaNode.name.includes('Button')) type = 'button'; // 簡易的元件名稱規則映射

  // 2. 清洗樣式
  const styles = extractStyles(figmaNode);

  // 3. 遞迴處理子節點
  const children = (figmaNode.children ?? []).map(transformToUINode);

  const node: UINode = {
    id: figmaNode.id,
    name: figmaNode.name,
    type,
    styles,
    children,
  };

  // 只有文字節點才帶純文字內容
  const characters = (figmaNode as { characters?: unknown }).characters;
  if (typeof characters === 'string') node.textContents = characters;

  return node;
}

// ─── 樣式清洗 ────────────────────────────────────────────────────────
// 以下把 Figma raw 欄位映射到 UIStyleToken。FigmaNode 的額外欄位型別為 unknown，
// 這裡用一個 raw 視圖描述「我們關心的」原始欄位，集中處理型別轉換。

interface FigmaRaw {
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  layoutSizingHorizontal?: 'FIXED' | 'HUG' | 'FILL';
  layoutSizingVertical?: 'FIXED' | 'HUG' | 'FILL';
  absoluteBoundingBox?: { width?: number; height?: number };
  cornerRadius?: number;
  fills?: Array<{
    type?: string;
    visible?: boolean;
    opacity?: number;
    color?: { r: number; g: number; b: number; a?: number };
  }>;
  style?: {
    fontSize?: number;
    fontWeight?: number;
    textAlignHorizontal?: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  };
}

// Figma 對齊列舉 → 我們的語意（無對應者略過，例如 BASELINE / JUSTIFIED）。
const PRIMARY_ALIGN: Record<string, NonNullable<UIStyleToken['justifyContent']>> = {
  MIN: 'start',
  CENTER: 'center',
  MAX: 'end',
  SPACE_BETWEEN: 'space-between',
};
const COUNTER_ALIGN: Record<string, NonNullable<UIStyleToken['alignItems']>> = {
  MIN: 'start',
  CENTER: 'center',
  MAX: 'end',
};
const TEXT_ALIGN: Record<string, NonNullable<UIStyleToken['textAlign']>> = {
  LEFT: 'left',
  CENTER: 'center',
  RIGHT: 'right',
};

export function extractStyles(figmaNode: FigmaNode): UIStyleToken {
  const raw = figmaNode as unknown as FigmaRaw;
  const styles: UIStyleToken = {};

  // 版面（Auto Layout）
  if (raw.layoutMode === 'HORIZONTAL') styles.flexDirection = 'row';
  else if (raw.layoutMode === 'VERTICAL') styles.flexDirection = 'column';

  if (raw.primaryAxisAlignItems && PRIMARY_ALIGN[raw.primaryAxisAlignItems]) {
    styles.justifyContent = PRIMARY_ALIGN[raw.primaryAxisAlignItems];
  }
  if (raw.counterAxisAlignItems && COUNTER_ALIGN[raw.counterAxisAlignItems]) {
    styles.alignItems = COUNTER_ALIGN[raw.counterAxisAlignItems];
  }

  if (raw.itemSpacing != null) styles.gap = raw.itemSpacing;

  if (
    raw.paddingTop != null ||
    raw.paddingRight != null ||
    raw.paddingBottom != null ||
    raw.paddingLeft != null
  ) {
    styles.padding = {
      top: raw.paddingTop ?? 0,
      right: raw.paddingRight ?? 0,
      bottom: raw.paddingBottom ?? 0,
      left: raw.paddingLeft ?? 0,
    };
  }

  const width = mapSizing(raw.layoutSizingHorizontal, raw.absoluteBoundingBox?.width);
  if (width !== undefined) styles.width = width;
  const height = mapSizing(raw.layoutSizingVertical, raw.absoluteBoundingBox?.height);
  if (height !== undefined) styles.height = height;

  // 外觀
  if (raw.cornerRadius != null) styles.borderRadius = raw.cornerRadius;

  const fillColor = firstSolidFill(raw.fills);
  if (fillColor) {
    // 文字節點的 fill 是文字色，其餘視為背景色。
    if (figmaNode.type === 'TEXT') styles.color = fillColor;
    else styles.backgroundColor = fillColor;
  }

  // 文字
  if (raw.style) {
    if (raw.style.fontSize != null) styles.fontSize = raw.style.fontSize;
    if (raw.style.fontWeight != null) styles.fontWeight = raw.style.fontWeight;
    if (raw.style.textAlignHorizontal && TEXT_ALIGN[raw.style.textAlignHorizontal]) {
      styles.textAlign = TEXT_ALIGN[raw.style.textAlignHorizontal];
    }
  }

  return styles;
}

// Figma Resizing：FILL/HUG 直接對應語意，FIXED 取實際像素寬高。
function mapSizing(
  mode: FigmaRaw['layoutSizingHorizontal'],
  fixedPx: number | undefined,
): 'fill' | 'hug' | number | undefined {
  if (mode === 'FILL') return 'fill';
  if (mode === 'HUG') return 'hug';
  if (mode === 'FIXED') return fixedPx;
  return undefined;
}

// 取第一個可見的 SOLID 填色，轉成 CSS 色字串。
function firstSolidFill(fills: FigmaRaw['fills']): string | undefined {
  const solid = fills?.find((f) => f.type === 'SOLID' && f.visible !== false && f.color);
  if (!solid?.color) return undefined;
  const alpha = (solid.color.a ?? 1) * (solid.opacity ?? 1);
  return rgbaToCss(solid.color.r, solid.color.g, solid.color.b, alpha);
}

// Figma 色彩為 0~1 浮點數；alpha < 1 時輸出 rgba()，否則輸出 #rrggbb。
function rgbaToCss(r: number, g: number, b: number, a: number): string {
  const to255 = (v: number) => Math.round(v * 255);
  if (a < 1) {
    return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${Number(a.toFixed(3))})`;
  }
  const hex = (v: number) => to255(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
