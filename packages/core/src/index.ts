import { parseFigmaNode } from '@codegen/parser';

// 載入 .env（Node 20.12+ 內建；已存在的環境變數優先、不覆蓋）。
process.loadEnvFile();

const fileKey = process.env.FIGMA_FILE_KEY;
const nodeId = process.env.FIGMA_NODE_ID;
const token = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;

async function main() {
  if (!fileKey || !nodeId || !token) {
    console.error('缺少環境變數，請確認 .env 內有 FIGMA_FILE_KEY / FIGMA_NODE_ID / FIGMA_PERSONAL_ACCESS_TOKEN');
    process.exitCode = 1;
    return;
  }

  console.log('[Core] 產生器啟動，抓取並清洗 Figma 節點...');
  const ui = await parseFigmaNode(fileKey, nodeId, token);

  console.log(`[Core] 清洗完成：${ui.name}（${ui.type}），子節點 ${ui.children.length} 個`);
  console.log(JSON.stringify(ui, null, 2));
}

main().catch((err) => {
  console.error('產生失敗：', err instanceof Error ? err.message : err);
  // 不用 process.exit()：避免 fetch socket 關閉中硬退出在 Windows 觸發 libuv 崩潰。
  process.exitCode = 1;
});
