# figma-universal-codegen

把 Figma 設計節點轉換成程式碼的工具。核心概念是：Figma 的 `/files/:key/nodes` API 回傳的不是截圖，而是包含圖層名稱、AutoLayout 排版方向、間距、文字內容、色彩等極詳細的 **metadata**，因此可以據此還原版面並產生程式碼。

## Monorepo 結構

使用 pnpm workspace（[pnpm-workspace.yaml](../pnpm-workspace.yaml)：`packages/*`），目前分為四個套件：

| 套件 | 路徑 | 職責 | 相依 |
|---|---|---|---|
| `@codegen/shared` | [packages/shared](../packages/shared) | 共用型別（`UINode`、`UIStyleToken`、`BaseGenerator` 等），無對外相依 | — |
| `@codegen/parser` | [packages/parser](../packages/parser) | 抓取並清洗 Figma 節點、Style Strategy、Component Resolver | `@codegen/shared` |
| `@codegen/core` | [packages/core](../packages/core) | Orchestrator 進入點，串接 Parser／Style Engine／Component Resolver | `@codegen/parser` |
| `@codegen/generators` | [packages/generators](../packages/generators) | 各框架程式碼產生器（vue3 / nuxt / react / next），繼承 `BaseGenerator`，共用 parser 的 Style Engine 與 Component Resolver | `@codegen/parser`、`@codegen/shared` |

## 文件

- **[開發環境設定](./development-setup.md)** — Node / pnpm 版本需求、如何用 fnm + corepack 把版本釘住、版本飄移的排錯。
- **[Figma Fetcher 模組](./figma-fetcher.md)** — `fetchFigmaNodes` 的用法、`.env` 設定、測試方式、429 限流與注意事項。
- **[Style Strategy 轉譯策略](./style-strategy.md)** — 轉譯策略（Strategy Pattern）的設計理念與 Tailwind 轉譯策略實作。
- **[框架程式碼產生器](./generators.md)** — vue3 / nuxt / react / next 產生器的繼承關係、各框架轉換差異重點，與可能踩的坑。

## 快速開始

```bash
corepack enable          # 啟用 packageManager 指定的 pnpm 版本
pnpm install
pnpm dev                 # 跑 core 進入點（需 .env，見 Figma Fetcher 文件）
pnpm test                # 跑所有單元測試（Node.js 內建 test runner）
```

抓取真實 Figma 節點的設定與測試，見 [Figma Fetcher 模組](./figma-fetcher.md)。

## CLI 用法

`pnpm codegen`（等同 `pnpm dev`）會抓取 `.env` 指定的 Figma 節點、清洗成 `UINode`，再依框架分流產生程式碼：

```bash
pnpm codegen --framework react              # 指定框架（vue3 / nuxt / react / next）
pnpm codegen --framework next --style css   # 同時指定樣式（tailwind / css）
pnpm codegen --framework vue3 --out generated   # 實際寫檔到 generated/<dir>/<檔名>
pnpm demo --framework react                 # 免 Figma 憑證，改用內建 mock AST
```

- 旗標可縮寫：`-f`（framework）、`-s`（style）、`-o`（out）。
- **優先序：CLI 旗標 > 環境變數（`CODEGEN_*`）> 預設值**（框架 `vue3`、樣式 `tailwind`）。
- 未給 `--out` 時印到終端機；給了才寫檔。
- 若 pnpm 攔截了旗標，改用 `pnpm codegen -- --framework react`（`--` 後的參數一律轉交腳本）。

## 環境變數（`.env`）

| 變數 | 必填 | 說明 |
|---|---|---|
| `FIGMA_FILE_KEY` | ✅ | Figma 檔案 URL 中的 key |
| `FIGMA_NODE_ID` | ✅ | 要抓取的節點 ID |
| `FIGMA_PERSONAL_ACCESS_TOKEN` | ✅ | Figma 個人存取 Token |
| `CODEGEN_FRAMEWORK` | 選填 | 目標框架，預設 `vue3`（可選 `nuxt` / `react` / `next`） |
| `CODEGEN_STYLE` | 選填 | 樣式模式，預設 `tailwind`（可選 `css`） |
