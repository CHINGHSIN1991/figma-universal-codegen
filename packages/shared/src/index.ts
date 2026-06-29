// 通用 UI 中介格式（Intermediate Representation）。
// Figma 單一節點的 JSON 常達數千行，充滿 miterLimit、scrollBehavior 等渲染雜訊；
// 這裡定義我們自己標準化、清洗後的結構，作為各 codegen 後端的共同輸入。

export type UIElementType = 'page' | 'container' | 'button' | 'text' | 'input' | 'image';

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
  name: string;          // Figma 上的圖層名稱（例如 "SubmitButton"）
  type: UIElementType;   // 我們標準化後的型別
  styles: UIStyleToken;  // 清洗後的樣式
  textContents?: string; // 如果是文字節點，記錄其純文字
  children: UINode[];    // 遞迴子節點
}
