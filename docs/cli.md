# CLI 控制台

`@codegen/core` 提供命令列入口，把整條流水線（抓取 Figma → 清洗成 `UINode` → 依框架分流產生器 → 輸出程式碼）包成一個指令。CLI 以 [cac](https://github.com/cacjs/cac) 解析參數，互動式問答（補齊缺漏參數）使用 [inquirer](https://github.com/SBoudrias/Inquirer.js)。

## 入口檔案

| 檔案 | 對應指令 | 角色 |
|---|---|---|
| [cli.ts](../packages/core/src/cli.ts) | `pnpm codegen` | 正式 CLI（cac）。宣告 `generate` 命令與參數，呼叫 `runGenerate` |
| [pipeline.ts](../packages/core/src/pipeline.ts) | — | 核心管線 `runGenerate(opts)`：抓取→清洗→分流→輸出。被各入口共用 |
| [index.ts](../packages/core/src/index.ts) | `pnpm dev` | 以環境變數為主的快速執行；仍支援 `-f` / `-s` / `-o` 簡易旗標 |
| [demo.ts](../packages/core/src/demo.ts) | `pnpm demo` | 免 Figma 憑證，用內建 mock AST 示範四框架產出 |

> 為什麼分成這些檔案：`runGenerate` 是唯一一份產生邏輯，`cli.ts` / `index.ts` 只是不同的「參數來源」前端（cac 旗標 vs 環境變數），避免重複。框架分流本身由 [generators 的 `createGenerator`](./generators.md) 負責。

## `generate` 命令

```bash
pnpm codegen generate [options]
```

| 參數 | 預設 | 說明 |
|---|---|---|
| `--file <fileKey>` | `.env` 的 `FIGMA_FILE_KEY` | Figma 檔案的 File Key |
| `--node <nodeId>` | `.env` 的 `FIGMA_NODE_ID` | 指定的 Figma 節點 ID |
| `--framework <fw>` | `vue3` | 目標框架：`vue3` / `nuxt` / `react` / `next` |
| `--style <style>` | `tailwind` | 樣式引擎：`tailwind` / `css` |
| `--out <dir>` | （無） | 輸出目錄；省略則印到終端機 |

Figma token 一律取自 `.env` 的 `FIGMA_PERSONAL_ACCESS_TOKEN`，不接受用旗標傳入（避免出現在 shell 歷史）。

## 範例

```bash
pnpm codegen generate --help                            # 列出所有參數
pnpm codegen generate --framework react                 # 用 .env 的 file/node，產出 React
pnpm codegen generate --framework next --style css      # Next + inline style
pnpm codegen generate --file ABC123 --node 1:23         # 直接指定來源節點
pnpm codegen generate --framework vue3 --out generated  # 寫檔到 generated/<dir>/<檔名>
```

- 若 pnpm 攔截了旗標，改用 `pnpm codegen generate -- --framework react`（`--` 後一律轉交腳本）。
- 參數優先序：**CLI 旗標 > 環境變數（`CODEGEN_*`）> 預設值**。

## 輸出方式

- **未給 `--out`**：把產生的程式碼印到終端機（stdout），方便先預覽。
- **給了 `--out <dir>`**：寫檔到 `<dir>/<getOutputDir>/<getFileName>`。其中目錄與檔名由各產生器決定，例如：
  - Nuxt 的頁面 → `pages/`；Next 的頁面 → `page.tsx`（見 [generators 文件](./generators.md)）。

## 錯誤處理

缺少 `--file` / `--node` / token 時，`runGenerate` 會丟出明確訊息並以 exit code 1 結束：

```
產生失敗： 缺少必要參數：--file（或 FIGMA_FILE_KEY）、--node（或 FIGMA_NODE_ID）、FIGMA_PERSONAL_ACCESS_TOKEN（需置於 .env）
```

> 此缺漏參數的處理點，即互動式問答（inquirer）的接入位置：未來會在這裡改成引導使用者逐項輸入，而非直接報錯。

## 相關文件

- [Figma Fetcher 模組](./figma-fetcher.md) — `.env` 設定、token 取得、429 限流。
- [框架程式碼產生器](./generators.md) — `createGenerator` 分流、各框架差異與檔名規則。
- [Style Strategy 轉譯策略](./style-strategy.md) — `--style` 背後的 Tailwind / CSS 轉譯。
