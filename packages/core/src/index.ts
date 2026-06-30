import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { parseArgs } from 'util';
import { parseFigmaNode, MappingConfig } from '@codegen/parser';
import { createGenerator } from '@codegen/generators';
import { StyleMode } from './orchestrator.js';

// 載入 .env（Node 20.12+ 內建；已存在的環境變數優先、不覆蓋）。
process.loadEnvFile();

// CLI 旗標解析（對應 `pnpm codegen --framework react --style tailwind`）。
// strict: false 讓未知旗標不致直接報錯。
const { values: cli } = parseArgs({
  args: process.argv.slice(2),
  options: {
    framework: { type: 'string', short: 'f' },
    style: { type: 'string', short: 's' },
    out: { type: 'string', short: 'o' }, // 指定則寫檔；否則印到 stdout
  },
  strict: false,
});

const fileKey = process.env.FIGMA_FILE_KEY;
const nodeId = process.env.FIGMA_NODE_ID;
const token = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;
// 優先序：CLI 旗標 > 環境變數 > 預設值
const framework = (cli.framework as string) ?? process.env.CODEGEN_FRAMEWORK ?? 'vue3';
const styleMode = ((cli.style as string) ?? process.env.CODEGEN_STYLE ?? 'tailwind') as StyleMode;
const outDir = (cli.out as string) ?? process.env.CODEGEN_OUT;

// mapping.config.json 位於 monorepo 根目錄
const config: MappingConfig = JSON.parse(
  readFileSync(resolve(process.cwd(), 'mapping.config.json'), 'utf-8'),
);

async function main() {
  if (!fileKey || !nodeId || !token) {
    console.error('缺少環境變數，請確認 .env 內有 FIGMA_FILE_KEY / FIGMA_NODE_ID / FIGMA_PERSONAL_ACCESS_TOKEN');
    process.exitCode = 1;
    return;
  }

  console.log('[Core] 產生器啟動，抓取並清洗 Figma 節點...');
  const ui = await parseFigmaNode(fileKey, nodeId, token);
  console.log(`[Core] 清洗完成：${ui.name}（${ui.type}），子節點 ${ui.children.length} 個`);

  // 一鍵分流：依 framework 取得對應產生器，直接產出可寫入檔案的程式碼字串。
  const generator = createGenerator(framework);
  const code = generator.generateComponent(ui, {
    styleMode,
    // MappingConfig 結構相容，僅補上對外的寬鬆型別。
    mappingConfig: config as unknown as Record<string, unknown>,
  });
  const relPath = `${generator.getOutputDir(ui)}/${generator.getFileName(ui)}`;

  if (outDir) {
    // 指定 --out 時實際寫檔到 <out>/<outputDir>/<fileName>
    const target = resolve(process.cwd(), outDir, relPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, code, 'utf-8');
    console.log(`\n[Core] 目標框架：${framework}（style: ${styleMode}）→ 已寫入 ${target}`);
  } else {
    // 未指定 --out 時印到 stdout
    console.log(`\n[Core] 目標框架：${framework}（style: ${styleMode}）→ ${relPath}`);
    console.log(code);
  }
}

main().catch((err) => {
  console.error('產生失敗：', err instanceof Error ? err.message : err);
  // 不用 process.exit()：避免 fetch socket 關閉中硬退出在 Windows 觸發 libuv 崩潰。
  process.exitCode = 1;
});
