# 開發環境設定

## 版本需求

| 工具 | 版本 | 如何管理 |
|---|---|---|
| Node.js | **24.x**（`tsconfig` 以 Node 22+ 的 ESM 規則為準） | fnm（建議） |
| pnpm | **10.x** | corepack（由 `package.json` 的 `packageManager` 欄位指定） |
| TypeScript | ^5.7 | 專案 devDependency |

`package.json` 已用 [`packageManager`](../package.json) 欄位釘住 pnpm 版本（`pnpm@10.18.0`），只要啟用 corepack，大家就會用到同一版 pnpm。

## 安裝步驟

```powershell
# 1. 用 fnm 安裝並切換到 Node 24
fnm install 24
fnm default 24

# 2. 啟用 corepack（Node 內建），它會依 packageManager 欄位自動切到正確的 pnpm 版本
corepack enable

# 3. 安裝相依套件
pnpm install
```

## 常用指令

```powershell
pnpm dev                                              # 跑 core 進入點
pnpm tsx packages/parser/src/figma-api.test-run.ts    # Figma 抓取 smoke test（需 .env，見 Figma Fetcher 文件）
pnpm tsc --noEmit                                     # 型別檢查
```

## TypeScript 設定重點（[tsconfig.json](../tsconfig.json)）

- `target: ES2022`、`module/moduleResolution: NodeNext`（ESM，**import 需加 `.js` 副檔名**）。
- `strict: true`、`skipLibCheck: true`。
- `paths` 設定 `@codegen/shared`、`@codegen/parser` 別名，讓 VSCode 的自動補全與「Go to Definition」能跨套件運作。

## 排錯：版本飄移

這台環境曾出現幾個因「全域工具殘留版本」造成的問題，整理如下，遇到時可對照：

**症狀 A：終端機 `node -v` 是 v24，但某些情境下卻跑到舊版 Node。**
fnm 是在開啟 shell 時由啟動 hook 動態注入 PATH，**只對互動式 shell 生效**。非互動式 shell（例如某些工具、IDE 從捷徑啟動的子程序）不會載入該 hook，會退回到系統安裝的 Node（若 `C:\Program Files\nodejs` 裝了舊版）。
→ 解法：從已啟用 fnm 的終端機啟動 IDE；或把系統那份舊 Node 升級/移除，讓 fallback 也是新版。

**症狀 B：`git diff` 顯示 `pnpm-lock.yaml` 有大量「格式」變動。**
觀察第一行 `lockfileVersion`：若從 `'9.0'` 變成 `5.4`，代表是被**舊版 pnpm（7.x）改寫降級**，不是真的相依性變更。每次用舊版 pnpm 跑 `pnpm install` 都會重演（舊版看不懂 v9 lockfile，會整份忽略並用 5.4 格式重寫）。
→ 排查：先確認實際跑到的是哪一版 pnpm。
```powershell
where.exe pnpm        # 列出 PATH 中所有 pnpm，排最前面的才是實際執行的那個
pnpm --version        # 應為 10.x；若是 7.x 就是元兇
```
常見根因是 **PATH 中有一份獨立安裝的舊 pnpm 蓋過 corepack 的 shim**（例如 `C:\Users\<user>\AppData\Local\pnpm\pnpm.exe`，且 `PNPM_HOME` 把它排在 PATH 最前）。這份獨立執行檔**不理會 `packageManager` 欄位**，所以光 `corepack enable` 沒用，得讓它不再被解析到。
→ 解法：
1. `git restore pnpm-lock.yaml` 還原降級的 lockfile。
2. 移除（或改名）那份獨立安裝的 `pnpm.exe`，讓 `pnpm` fall through 到 corepack 的 10.x shim；確認 `pnpm --version` 回報 10.x。
3. 重新 `pnpm install`；正常情況下 lockfile 應維持 `'9.0'`，且只在新增套件時出現對應的 `importers` 小幅變更。

> 根因都是同一類：本機殘留了過時的全域 Node / pnpm。釘住 `packageManager` + 統一用 fnm 管 Node，即可避免。
