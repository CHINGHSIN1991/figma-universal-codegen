# Figma Fetcher 模組

位於 [packages/parser/src/figma-api.ts](../packages/parser/src/figma-api.ts)，負責直接呼叫 Figma REST API、取出指定節點的原始 document tree。

## `fetchFigmaNodes`

```ts
function fetchFigmaNodes(
  fileKey: string,   // Figma 檔案 key（網址 /file/<key>/ 的部分）
  nodeId: string,    // 目標節點 id（網址 ?node-id=<id>，例如 "402-485" 或 "402:485"）
  token: string,     // Figma personal access token
): Promise<FigmaNode>  // 回傳該節點、經 Zod 驗證過的 document 原始 tree
```

呼叫 `GET https://api.figma.com/v1/files/:fileKey/nodes?ids=:nodeId`，帶 `X-Figma-Token` 標頭。回傳的 document tree 含圖層名稱、type、AutoLayout 方向、間距、文字、色彩等 metadata。

### 實作重點

- 使用 **Node 內建的原生 `fetch`**（Node 18+，Node 24 已為穩定版），不依賴 axios 等第三方套件。
- 因為 `fetch` 不會對非 2xx 自動丟錯，模組內會檢查 `response.ok`，失敗時丟出含狀態碼的錯誤。
- **型別防線（Zod）**：回傳前用 `@codegen/shared` 的 `FigmaNodesResponseSchema` 驗證結構，不符就帶原因 fail fast（詳見下節）。
- **node id 格式相容**：Figma 網址裡的 node id 用 `-`（如 `402-485`），但 API 回傳的 key 用 `:`（`402:485`）。模組會兩種格式都嘗試查找，所以可以直接貼網址上的 id。
- 若回傳中找不到該節點（或無 `document`），會丟出明確錯誤訊息。

## 型別防線（Zod）

在 [packages/shared/src/index.ts](../packages/shared/src/index.ts) 定義，用來在「清洗成 `UINode` 之前」先確保 Figma 回傳結構符合最低假設：

- `FigmaNodeSchema`：遞迴節點 schema，只驗證實際會用到的欄位（`id` / `name` / `type` / `children`），其餘上千個渲染欄位用 `z.looseObject` **放行**，避免因 Figma 多回欄位而誤判。
- `FigmaNodesResponseSchema`：驗證外層 `{ nodes: { "<id>": { document } } }`。
- 匯出 `FigmaNode` 介面與 `FigmaNodesResponse` 型別供其他模組使用。

> 注意：此 schema 會**遞迴驗證整棵樹**，假設每個節點都有 `id`/`name`/`type`（實務上 Figma 節點皆成立）。若 Figma 改了 API 合約，`fetchFigmaNodes` 會在驗證階段 fail fast。

## `.env` 設定

抓取需要三個環境變數，範本見 [.env.example](../.env.example)：

```
FIGMA_PERSONAL_ACCESS_TOKEN=figd_...
FIGMA_FILE_KEY=...
FIGMA_NODE_ID=...
```

`.env` 已列入 [.gitignore](../.gitignore)，請自行複製 `.env.example` 為 `.env` 並填入。手動測試腳本用 Node 20.12+ 內建的 `process.loadEnvFile()` 載入，**不需安裝 dotenv**。

## 測試方式

### 1. 手動 smoke test（打真實 API）

[packages/parser/src/figma-api.test-run.ts](../packages/parser/src/figma-api.test-run.ts)：

```powershell
pnpm tsx packages/parser/src/figma-api.test-run.ts
```

成功會印出節點 name / type / children 數量，再接完整 JSON。用於確認「真的連得上 Figma、token 有效、結構正確」。

### 2. 自動化單元測試（建議，mock fetch）

真實 API 會被限流（見下），不適合反覆跑。建議用 Node 24 內建的 `node:test` + mock `globalThis.fetch`，無需網路與 token，目前涵蓋：正常回傳、node-id 的 `-`/`:` fallback、非 2xx 丟錯、找不到節點丟錯、Zod 結構不符丟錯。

```powershell
pnpm test    # = tsx --test "packages/**/src/**/*.test.ts"
```

> 命名慣例：自動化測試用 `*.test.ts`；打真實 API 的手動腳本用 `*.test-run.ts`，兩者區分開。

## 注意事項

- **429 Too Many Requests**：短時間內重複呼叫真實 API 會被 Figma 限流，重置需數分鐘。請改用單元測試做反覆驗證，真實腳本只偶爾跑一次。
- **不要用 `process.exit()` 硬退出**：`fetch` 底層 socket 關閉中時硬呼叫 `process.exit()`，在 Windows 會觸發 libuv 斷言崩潰（`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`）。錯誤處理改設 `process.exitCode = 1`，讓 event loop 收尾後自然結束。
