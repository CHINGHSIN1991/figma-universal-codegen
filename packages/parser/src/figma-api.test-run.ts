import { fetchFigmaNodes } from './figma-api.js';

// 載入 .env（Node 20.12+ 內建 process.loadEnvFile，從 cwd 讀取 .env；已存在的環境變數優先、不覆蓋）
// 預期從專案根目錄執行：pnpm tsx packages/parser/src/figma-api.test-run.ts
process.loadEnvFile();

const fileKey = process.env.FIGMA_FILE_KEY;
const nodeId = process.env.FIGMA_NODE_ID;
const token = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;

if (!fileKey || !nodeId || !token) {
  console.error('缺少環境變數，請確認 .env 內有 FIGMA_FILE_KEY / FIGMA_NODE_ID / FIGMA_PERSONAL_ACCESS_TOKEN');
  process.exit(1);
}

async function main() {
  console.log(`正在抓取 fileKey=${fileKey} nodeId=${nodeId} ...`);
  const document = await fetchFigmaNodes(fileKey!, nodeId!, token!);

  console.log('\n=== 取得的 document 節點 ===');
  console.log('name:', document.name);
  console.log('type:', document.type);
  console.log('children 數量:', document.children?.length ?? 0);

  // 看完整結構（會很深，方便確認 metadata 內容）
  console.log('\n=== 完整 JSON ===');
  console.log(JSON.stringify(document, null, 2));
}

main().catch((err) => {
  console.error('抓取失敗：', err instanceof Error ? err.message : err);
  // 不用 process.exit()：fetch 的 socket 可能還在關閉，硬退出會在 Windows 觸發
  // libuv 斷言崩潰（UV_HANDLE_CLOSING）。設 exitCode 讓 event loop 收尾後自然結束。
  process.exitCode = 1;
});
