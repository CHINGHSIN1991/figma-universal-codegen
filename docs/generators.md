# 框架程式碼產生器 (Generators)

`@codegen/generators` 把清洗後的 `UINode` AST 轉成各框架可直接寫入檔案的程式碼字串。所有產生器都繼承自 [`BaseGenerator`](../packages/shared/src/base-generator.ts)，並**共用** parser 提供的兩個建構元件，而非各自重做：

- **Style Engine**（[`TailwindStrategy` / `CssStrategy`](../packages/parser/src/style-strategy.ts)）— 把 `node.styles`（`UIStyleToken`）轉成樣式字串，由 `options.styleMode` 切換。
- **Component Resolver**（[`resolveComponentTag`](../packages/parser/src/component-resolver.ts)）— 把圖層名稱映射為自訂元件或退回 HTML 標籤。

> **共同行為：優先沿用 AST 已解析的映射。** 若 Parser 已在節點上填好 `targetComponent`，產生器會直接沿用（與 [orchestrator](../packages/core/src/orchestrator.ts) 一致），只有未解析時才即時呼叫 `resolveComponentTag`。

## 繼承關係

```
BaseGenerator (abstract, @codegen/shared)
├── Vue3Generator ............ .vue  / <template> + <script setup>
│   └── NuxtGenerator ........ 特化：auto-import、pages/components 目錄
└── ReactGenerator ........... .tsx  / export function + JSX
    └── NextGenerator ........ 特化：'use client' 注入、App Router page.tsx
```

`BaseGenerator` 的契約：`generateComponent(ast, options) → string`、`getFileExtension()`、`getOutputDir(ast)`、`getFileName(ast)`。後兩者有預設值（`'components'`、`圖層名稱 + 副檔名`），框架可覆寫。

## 各框架轉換差異重點

| 面向 | Vue3 | Nuxt | React | Next |
|---|---|---|---|---|
| `frameworkName` | `vue3` | `nuxt` | `react` | `next` |
| 副檔名 | `.vue` | `.vue` | `.tsx` | `.tsx` |
| tailwind 樣式屬性 | `class="..."` | 同 Vue3 | `className="..."` | 同 React |
| css 樣式屬性 | `style="a: b;"`（**字串**） | 同 Vue3 | `style={{ a: 'b' }}`（**物件、camelCase**） | 同 React |
| 自訂元件 import | `import X from '...'`（預設） | 預設**不寫**（auto-import） | `import { X } from '...'`（具名） | 同 React |
| 外層骨架 | `<template>` + 條件式 `<script setup>` | 同 Vue3 | `import React` + `export function Name()` | 同 React |
| 文字轉義 | `& < >` 與 `{{` | 同 Vue3 | `& < >` 與 `{ }` | 同 React |
| `getOutputDir` | `components` | `page`→`pages`，其餘`components` | `components` | `components`（未特化） |
| `getFileName` | 圖層名 + `.vue` | 同上 | 圖層名 + `.tsx` | `page`→`page.tsx`，其餘 PascalCase`.tsx` |
| 專屬規則 | — | `autoImport` 開關（建構子傳入） | 元件名 PascalCase 正規化 | 互動節點 → 注入 `'use client';` |

### 為什麼 css 模式 Vue 用字串、React 用物件

Vue 的 `style="..."` 接受 CSS 字串，可直接套用 `CssStrategy` 的輸出。React 的 inline style **必須是物件且鍵為 camelCase**，因此 React/Next 會把 `CssStrategy` 的字串（`font-size: 24px;`）再轉成 `{ fontSize: '24px' }`。樣式對應邏輯仍只有一份（`CssStrategy`），React 只是多一層格式轉換。

### Nuxt 的 auto-import

Nuxt 預設 `autoImport: true`，元件無需 import 即可在 template 使用，故 `NuxtGenerator` 覆寫 `shouldImportCustomComponent()` 回傳 `false`，連帶省略整個 `<script setup>` 區塊。傳 `new NuxtGenerator({ autoImport: false })` 可還原成寫出 import 的行為。

### Next 的 `'use client'` 與 App Router

- **Client Component 標記**：`NextGenerator` 遞迴掃描整棵樹，只要任一節點 `hasClickEvent === true`，就在**檔案第一行**注入 `'use client';`（先於所有 import）。無互動則維持 React Server Component。
- **不是 `runtime = 'edge'`**：`export const runtime = 'edge'` 是 route segment 的執行環境設定，與「是否含客戶端互動」無關，故不使用。
- **檔名**：`type === 'page'` 的節點固定輸出 `page.tsx`，對應 App Router 的檔案約定。

## 使用範例

```ts
import { ReactGenerator } from '@codegen/generators';

const gen = new ReactGenerator();
const code = gen.generateComponent(ast, {
  styleMode: 'tailwind',
  mappingConfig, // 來自 mapping.config.json，必須含 `mappings` 鍵
});
// → import React from 'react'; ... export function Card() { return (...) }
```

## 可能踩的坑

以下每一條都附上「錯誤寫法 ❌ / 正確寫法 ✅」，多半是擴充或串接產生器時最容易直覺寫錯的地方。

### 1. `UINode` 沒有 `props`，樣式不能直接讀

很多範例（包含早期草稿）會寫 `node.props.className`，但 `UINode` 根本沒有 `props` 這個欄位——它的樣式放在 `node.styles`（型別是 `UIStyleToken`），而且是「框架無關的中介格式」，要經過 Style Engine 才會變成 class 或 style 字串。直接讀 `node.props` 在 TypeScript 會編譯不過，硬轉型則會在執行期拿到 `undefined`。

```ts
// ❌ 錯：UINode 沒有 props，這行不是編譯失敗就是拿到 undefined
const styleAttr = ` className="${node.props.className}"`;

// ✅ 對：用 Style Engine 把 node.styles 轉成字串
const strategy = options.styleMode === 'tailwind' ? new TailwindStrategy() : new CssStrategy();
const styleAttr = ` className="${strategy.parse(node.styles)}"`;
```

### 2. React 的 inline style 是「物件」，不是字串

`CssStrategy.parse()` 回傳的是 CSS 字串（`"font-size: 24px;"`），這在 Vue 可以直接塞進 `style="..."`。但 React 的 `style` 屬性**只吃物件**，而且鍵要 camelCase。如果把字串塞進去，React 會在執行期報錯：`The style prop expects a mapping from style properties to values, not a string`。

```tsx
// ❌ 錯：把 CSS 字串塞進 React style（執行期報錯）
<div style={"font-size: 24px; display: flex;"} />
// ❌ 也錯：JSON.stringify 出來還是字串
<div style={JSON.stringify({ fontSize: '24px' })} />

// ✅ 對：是一個物件，鍵為 camelCase、值為字串
<div style={{ fontSize: '24px', display: 'flex' }} />
```

`ReactGenerator` 內部用 `cssStringToReactStyle()` 把 `CssStrategy` 的字串轉成上面的物件字面量，樣式對應邏輯仍只維護一份。

### 3. 圖層名稱可能不是合法的函數名稱

Figma 的圖層名什麼都有可能：空格（`"Hero Card"`）、數字開頭（`"01 Banner"`）、符號（`"Btn / Primary"`）。直接拿來當 React 函數名或檔名會產生壞掉的 TSX。

```tsx
// ❌ 錯：直接用 ast.name
export function Hero Card() { ... }   // 語法錯誤：函數名不能有空格
export function 01Banner() { ... }    // 語法錯誤：識別字不能數字開頭

// ✅ 對：toComponentName() 先正規化成 PascalCase
// "Hero Card" → "HeroCard"
// "01 Banner" → "01Banner" → 仍是數字開頭（非合法識別字）→ 退回 "GeneratedComponent"
// ""／全是符號 → "GeneratedComponent"
export function HeroCard() { ... }
```

新增框架若也要產出具名元件，記得重用 `toComponentName`（已從 `react/index.ts` export）。

### 4. JSX 文字要轉義大括號 `{ }`

在 JSX 裡 `{` 會被當成「開始一段 JS 運算式」，所以設計稿文字若含 `{` 或 `}`（例如 `"{username}"`、`"折扣 {50%}"`）會直接讓 JSX 解析爆掉。Vue 的痛點則是 `{{ }}`（插值語法）。

```tsx
// ❌ 錯：原樣輸出，{ 被當成運算式起點
<span>請輸入 {username}</span>     // React 會試圖求值變數 username → 編譯錯誤

// ✅ 對：escapeJsxText() 把 < > & { } 轉成 HTML 實體
<span>請輸入 &#123;username&#125;</span>   // 畫面正確顯示「請輸入 {username}」
```

`ReactGenerator` 轉義 `< > & { }`；`Vue3Generator` 轉義 `< > &` 與 `{{`。新增框架時要依該框架的模板語法決定要逃逸哪些字元。

### 5. `frameworkName` 必須對上 `mapping.config.json` 的 key

`resolveComponentTag(name, framework, config)` 是用 `framework` 去 config 裡找該框架的 import 路徑。子類別的 `frameworkName` 跟父類別**不同**：Nuxt 是 `nuxt`（不是 `vue3`）、Next 是 `next`（不是 `react`）。所以 config 要為每個框架各寫一段；只寫 `react` 的話，Next 即時解析時會找不到該框架的 importPath。

```jsonc
// mapping.config.json
{
  "mappings": {
    "PrimaryButton": {
      "targetComponent": "BaseButton",
      "react": { "importPath": "@/components/ui/button" }
      // ⚠️ 沒有 "next" 區段 → NextGenerator 即時解析時 importPath 會是 null（不寫 import）
      // ✅ 補上： "next": { "importPath": "@/components/ui/button" }
    }
  }
}
```

> 注意：若節點在 Parser 階段就已填好 `targetComponent`/`importPath`（AST 預解析），產生器會直接沿用、**不**再查 config，就不受這條影響。這條只在「產生器自己即時呼叫 `resolveComponentTag`」時才會踩到。

### 6. `mappingConfig` 一定要有 `mappings` 鍵

`resolveComponentTag` 內部會存取 `config.mappings[name]`。如果傳進來的物件沒有 `mappings`（例如手滑傳了 `{}`），就會在 `undefined[name]` 直接丟 `TypeError`。型別雖然寬鬆寫成 `Record<string, unknown>`，但實際結構必須是合法的 `mapping.config.json`。

```ts
// ❌ 錯：沒有 mappings 鍵 → TypeError: Cannot read properties of undefined (reading 'PrimaryButton')
gen.generateComponent(ast, { styleMode: 'tailwind', mappingConfig: {} });

// ✅ 對：至少要有空的 mappings（代表「沒有任何映射規則，全部退回 HTML 標籤」）
gen.generateComponent(ast, { styleMode: 'tailwind', mappingConfig: { mappings: {} } });
```

### 7. import 去重是以「元件名稱 tag」為 key

收集 import 時用 `Map<tag, importPath>`，所以同一個 tag 對到兩個不同路徑時，**後出現的會蓋掉先前的**，最後只會留一筆 import。實務上同名元件通常本來就該來自同一路徑，但若 mapping 設定不一致就可能少掉 import。

```ts
// 樹中兩個節點都映射到 tag "Button"，但路徑不同：
//   A → { tag: 'Button', importPath: '@/ui/button' }
//   B → { tag: 'Button', importPath: '@/legacy/button' }
// 結果只會輸出最後寫入的那一筆：
//   import { Button } from '@/legacy/button';   // A 的路徑被覆蓋
```

### 8. `hasClickEvent` 目前沒有任何地方會自動填

Next 的 `'use client'` 注入條件是「樹中有節點 `hasClickEvent === true`」，但 Parser 還沒有從 Figma 抽取互動性，這個欄位目前**永遠是 undefined**。也就是說現階段除非上游手動標記，否則永遠不會注入 `'use client'`。這是刻意為未來預留的欄位。

```ts
// 現在要觸發 'use client'，得自己在 AST 上標記：
node.hasClickEvent = true;   // 未來會由 parser 依 Figma 的互動原型自動判斷
```

### 9. `getFileName` / `getOutputDir` 還沒有人呼叫

這兩個方法（含 Next 的 `page.tsx`、Nuxt 的 `pages/` 規則）已經實作好，但 `core` 目前只做到 orchestrate 並印出結果，**還沒串接到產生器與實際寫檔**。所以「page 會輸出成 page.tsx」這件事現在只在你直接呼叫該方法時成立，整條 CLI 寫檔流程要等後續步驟接上。

### 10. 固定輸出的 `import React` 在新版可能多餘

產生器固定在開頭寫 `import React from 'react';`。React 17+ 的新 JSX transform 其實不需要它，部分專案的 ESLint 會把它當成「未使用的 import」報警告。目前為了相容性保留，若你的目標專案用新 transform，可日後拿掉這行。

## 測試

每個產生器都有對應的 `*.test.ts`（`node:test`）。在 Windows + PowerShell 上，根目錄 `pnpm test` 的 `packages/**/...` glob 可能無法展開；可改用 Git Bash，或直接指定單一檔案：

```bash
pnpm tsx packages/generators/src/react/index.test.ts
pnpm tsc --noEmit        # 全專案型別檢查
```
