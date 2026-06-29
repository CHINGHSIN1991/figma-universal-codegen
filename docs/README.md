# figma-universal-codegen

把 Figma 設計節點轉換成程式碼的工具。核心概念是：Figma 的 `/files/:key/nodes` API 回傳的不是截圖，而是包含圖層名稱、AutoLayout 排版方向、間距、文字內容、色彩等極詳細的 **metadata**，因此可以據此還原版面並產生程式碼。

## Monorepo 結構

使用 pnpm workspace（[pnpm-workspace.yaml](../pnpm-workspace.yaml)：`packages/*`），目前分為三個套件：

| 套件 | 路徑 | 職責 | 相依 |
|---|---|---|---|
| `@codegen/shared` | [packages/shared](../packages/shared) | 共用型別（如 `TestAST`），無對外相依 | — |
| `@codegen/parser` | [packages/parser](../packages/parser) | 抓取並解析 Figma 節點（核心是 `fetchFigmaNodes`） | `@codegen/shared` |
| `@codegen/core` | [packages/core](../packages/core) | 產生器進入點，串接 parser | `@codegen/parser` |

> 註：`core` / `parser` 目前部分為 placeholder（例如 `parseFigmaNode` 仍回傳假 AST），實作中。真正已可運作的是 parser 的 Figma API 抓取（見下方文件）。

## 文件

- **[開發環境設定](./development-setup.md)** — Node / pnpm 版本需求、如何用 fnm + corepack 把版本釘住、版本飄移的排錯。
- **[Figma Fetcher 模組](./figma-fetcher.md)** — `fetchFigmaNodes` 的用法、`.env` 設定、測試方式、429 限流與注意事項。

## 快速開始

```powershell
corepack enable          # 啟用 packageManager 指定的 pnpm 版本
pnpm install
pnpm dev                 # 跑 core 進入點（目前為 placeholder）
```

抓取真實 Figma 節點的設定與測試，見 [Figma Fetcher 模組](./figma-fetcher.md)。
