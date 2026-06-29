import { z } from 'zod';

// 通用 UI 中介格式（Intermediate Representation）。
// Figma 單一節點的 JSON 常達數千行，充滿 miterLimit、scrollBehavior 等渲染雜訊；
// 這裡定義我們自己標準化、清洗後的結構，作為各 codegen 後端的共同輸入。

export type UIElementType = 'page' | 'container' | 'button' | 'text' | 'input' | 'image' | 'component';

export interface UIStyleToken {
  // 版面（Auto Layout）
  flexDirection?: 'row' | 'column';
  justifyContent?: 'start' | 'center' | 'end' | 'space-between'; // 主軸對齊，對應 Figma primaryAxisAlignItems
  alignItems?: 'start' | 'center' | 'end';                       // 交叉軸對齊，對應 Figma counterAxisAlignItems
  padding?: { top: number; right: number; bottom: number; left: number };
  gap?: number;
  width?: 'fill' | 'hug' | number;  // 對應 Figma 的 Resizing 機制
  height?: 'fill' | 'hug' | number;

  // 外觀
  backgroundColor?: string;
  borderRadius?: number;

  // 文字
  color?: string;        // 前景／文字色（對應 Figma 文字節點的 fills）
  fontSize?: number;
  fontWeight?: number;
  textAlign?: 'left' | 'center' | 'right';
}

export interface UINode {
  id: string;
  name: string;                 // Figma 上的圖層名稱（例如 "SubmitButton"）
  type: UIElementType;          // 我們標準化後的型別
  styles: UIStyleToken;         // 清洗後的樣式
  textContents?: string;        // 如果是文字節點，記錄其純文字
  children: UINode[];           // 遞迴子節點
  // 當 type === 'component' 時，以下欄位由 Component Resolver 填入
  targetComponent?: string;     // 映射後的元件名稱（例如 "BaseButton"）
  importPath?: string | null;   // 元件的 import 路徑（例如 "@/components/ui/button"）
}

// ─── Figma 原始回傳的型別防線（Zod）─────────────────────────────────
// 用途：在清洗成 UINode 之前，先驗證 Figma API 回傳的結構是否符合我們的最低假設。
// 只驗證實際會用到的欄位（id / name / type / children），其餘上千個渲染欄位
// 用 looseObject 放行，避免因 Figma 多回欄位而誤判。

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  [key: string]: unknown; // 放行其餘 Figma 雜訊欄位
}

export const FigmaNodeSchema: z.ZodType<FigmaNode> = z.lazy(() =>
  z.looseObject({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    children: z.array(FigmaNodeSchema).optional(),
  }),
);

// /files/:key/nodes 的回傳外層：{ nodes: { "<id>": { document: <FigmaNode> } } }
export const FigmaNodesResponseSchema = z.object({
  nodes: z.record(
    z.string(),
    z.looseObject({ document: FigmaNodeSchema }),
  ),
});

export type FigmaNodesResponse = z.infer<typeof FigmaNodesResponseSchema>;

export { BaseGenerator, type GenerateOptions } from './base-generator.js';
