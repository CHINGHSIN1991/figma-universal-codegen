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

## Tailwind 轉譯策略 (`TailwindStrategy`)

目前實作了 `TailwindStrategy`：
- 將排版方向對應到 `flex`, `flex-col`, `flex-row`。
- 將 `gap` 像素數值轉換為 Tailwind 級距（級距為 `gap / 4`）。
- 處理內邊距 `padding`。若四邊對齊，輸出單一類名（如 `p-4`）；若不對稱，則輸出細分方向類名（如 `pt-2 pr-4 pb-2 pl-4`）。

## 原生 CSS / CSS Modules 轉譯策略 (`CssStrategy`)

我們也實作了 `CssStrategy` 用以處理需要標準 CSS 屬性聲明的專案：
- 將 `flexDirection` 排版對應輸出為 `display: flex; flex-direction: <row|column>;`。
- 將 `gap` 像素數值轉換為標準 CSS `gap: <gap>px;`。
- 處理內邊距 `padding`。若四邊對齊，輸出 `padding: <padding>px;`；若不對稱，則輸出 shorthand 寫法（如 `padding: 4px 8px 12px 16px;`）。

## 測試與驗證

我們使用 Node.js 內建的 `node:test` 對轉譯策略進行了完整的測試覆蓋，測試檔案為 [packages/parser/src/style-strategy.test.ts](../packages/parser/src/style-strategy.test.ts)。

執行測試指令：
```powershell
npx tsx packages/parser/src/style-strategy.test.ts
```
