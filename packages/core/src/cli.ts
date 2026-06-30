import { cac } from 'cac';
import inquirer from 'inquirer';
import { StyleMode } from './orchestrator.js';
import { runGenerate } from './pipeline.js';

// 載入 .env（若存在）；--file/--node 也可改由旗標傳入，故 .env 不存在時忽略。
try {
  process.loadEnvFile();
} catch {
  // 無 .env：憑證改由實際環境變數或旗標提供。
}

const cli = cac('codegen');

cli
  .command('generate', '從 Figma 連結或節點生成前端程式碼')
  .option('--file <fileKey>', 'Figma 檔案的 File Key')
  .option('--node <nodeId>', '指定的 Figma 節點 ID')
  .option('--framework <framework>', '目標框架 (vue3, react, next, nuxt)', { default: 'vue3' })
  .option('--style <style>', '樣式引擎 (tailwind, css)', { default: 'tailwind' })
  .option('--out <dir>', '輸出目錄（省略則印到終端機）')
  .action(async (options) => {
    let { file, node, framework, style, out } = options;

    // 若缺少必要參數，以互動式問答引導補齊
    const questions: inquirer.DistinctQuestion[] = [];
    if (!file) questions.push({ type: 'input', name: 'file', message: '請輸入 Figma File Key:' });
    if (!node) questions.push({ type: 'input', name: 'node', message: '請輸入 Figma Node ID:' });

    if (questions.length > 0) {
      const answers = await inquirer.prompt(questions);
      file = file ?? answers.file;
      node = node ?? answers.node;
    }

    console.log(`\n🚀 啟動任務：File[${file}] Node[${node}] -> 轉譯為 [${framework} + ${style}]...`);

    await runGenerate({
      file,
      node,
      framework,
      style: style as StyleMode,
      out,
    });
  });

cli.help();

// 用 run: false + runMatchedCommand 以正確 await 非同步 action 並捕捉錯誤。
async function main() {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
}

main().catch((err) => {
  console.error('產生失敗：', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
