import { parseArgs } from 'util';
import { StyleMode } from './orchestrator.js';
import { runGenerate } from './pipeline.js';

// 以環境變數為主的快速進入點（`pnpm dev`）。完整 CLI 請見 cli.ts（`pnpm codegen generate`）。
try {
  process.loadEnvFile();
} catch {
  // 無 .env 時忽略；憑證可由實際環境變數提供。
}

// 仍保留簡易旗標（--framework / --style / --out），方便 `pnpm dev` 直接覆寫。
const { values: cli } = parseArgs({
  args: process.argv.slice(2),
  options: {
    framework: { type: 'string', short: 'f' },
    style: { type: 'string', short: 's' },
    out: { type: 'string', short: 'o' },
  },
  strict: false,
});

// 優先序：CLI 旗標 > 環境變數 > 預設值
runGenerate({
  file: process.env.FIGMA_FILE_KEY,
  node: process.env.FIGMA_NODE_ID,
  framework: (cli.framework as string) ?? process.env.CODEGEN_FRAMEWORK ?? 'vue3',
  style: ((cli.style as string) ?? process.env.CODEGEN_STYLE ?? 'tailwind') as StyleMode,
  out: (cli.out as string) ?? process.env.CODEGEN_OUT,
}).catch((err) => {
  console.error('產生失敗：', err instanceof Error ? err.message : err);
  // 不用 process.exit()：避免 fetch socket 關閉中硬退出在 Windows 觸發 libuv 崩潰。
  process.exitCode = 1;
});
