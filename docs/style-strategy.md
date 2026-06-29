# Style Engine & 轉譯策略 (Style Strategy)

Style Strategy 的設計職責是將 Figma 原始標註（絕對數值）轉換為與前端框架無關的排版與樣式類名。

## 設計理念 (Strategy Pattern)

Figma 設計稿的欄位（如 `itemSpacing`, `paddingTop` 等）在導出時往往是非常底層且帶有雜訊的絕對數值。不同專案可能會要求不同的 CSS 輸出格式：
1. **Tailwind CSS** (排版類名，例如 `gap-4 p-4`)
2. **Vanilla CSS / SCSS** (傳統樣式屬性，例如 `gap: 16px; padding: 16px;`)
3. **Inline Styles** (行內樣式對象，例如 `style={{ gap: '16px' }}`)

藉由使用 **策略模式 (Strategy Pattern)**，我們定義了 `StyleStrategy` 介面。遇到不同的框架或樣式需求時，僅需實作不同的 Strategy，而解析 Figma 的主管線不需要做任何調整。

## 介面定義 (`StyleStrategy`)

位於 [packages/parser/src/style-strategy.ts](../packages/parser/src/style-strategy.ts)：

```ts
import { UIStyleToken } from '@codegen/shared';

export interface StyleStrategy {
  // 輸入清洗後的樣式 Token，輸出最終要填入標籤的字串
  parse(tokens: UIStyleToken): string;
}
```

## 屬性覆蓋率（13 / 13）

兩個 Strategy 皆已覆蓋 `UIStyleToken` 定義的全部 13 個欄位：

| `UIStyleToken` 欄位 | `TailwindStrategy` 輸出範例 | `CssStrategy` 輸出範例 |
|---|---|---|
| `flexDirection: 'column'` | `flex flex-col` | `display: flex; flex-direction: column;` |
| `justifyContent: 'center'` | `justify-center` | `justify-content: center;` |
| `alignItems: 'end'` | `items-end` | `align-items: flex-end;` |
| `gap: 16` | `gap-4` | `gap: 16px;` |
| `padding: {8,8,8,8}` | `p-2` | `padding: 8px;` |
| `padding: {4,8,12,16}` | `pt-1 pr-2 pb-3 pl-4` | `padding: 4px 8px 12px 16px;` |
| `width: 'fill'` | `w-full` | `width: 100%;` |
| `width: 48` | `w-[48px]` | `width: 48px;` |
| `height: 'hug'` | `h-fit` | `height: fit-content;` |
| `backgroundColor: '#ff0000'` | `bg-[#ff0000]` | `background-color: #ff0000;` |
| `borderRadius: 8` | `rounded-[8px]` | `border-radius: 8px;` |
| `color: '#333'` | `text-[#333]` | `color: #333;` |
| `fontSize: 16` | `text-[16px]` | `font-size: 16px;` |
| `fontWeight: 700` | `font-bold` | `font-weight: 700;` |
| `textAlign: 'center'` | `text-center` | `text-align: center;` |

> **Tailwind 特殊轉換規則：**
> - `gap` / `padding` 數值除以 4 對應到 Tailwind spacing scale（例：`16px → gap-4`）
> - 顏色與 `borderRadius` 使用任意值語法（`bg-[#hex]`、`rounded-[Npx]`），支援 Figma 任意數值
> - `fontWeight` 對應語意化 class（`font-bold` 等），非標準值 fallback 為 `font-[N]`
> - `alignItems` 的 `start`/`end` 對應 CSS Flexbox 的 `flex-start`/`flex-end`（非 `start`/`end`）

## Tailwind 轉譯策略 (`TailwindStrategy`)

位於 [packages/parser/src/style-strategy.ts](../packages/parser/src/style-strategy.ts)，將 `UIStyleToken` 轉換為 Tailwind utility class 字串，可直接填入元件的 `class` 屬性。

## 原生 CSS / CSS Modules 轉譯策略 (`CssStrategy`)

同一檔案，將 `UIStyleToken` 轉換為標準 CSS 屬性宣告字串，適用於 CSS Modules 或 `style` 屬性。

## 測試與驗證

使用 Node.js 內建的 `node:test` 撰寫單元測試，測試檔案為 [packages/parser/src/style-strategy.test.ts](../packages/parser/src/style-strategy.test.ts)。

```bash
pnpm test    # 跑所有測試（含 style-strategy、transform、figma-api）
```
