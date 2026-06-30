import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { parseFigmaNode, MappingConfig } from '@codegen/parser';
import { createGenerator } from '@codegen/generators';
import { StyleMode } from './orchestrator.js';
import { formatCode } from './formatter.js';

/** 一次產生作業所需的參數（由 CLI 旗標或環境變數提供）。 */
export interface GenerateRunOptions {
  /** Figma File Key；省略時退回 FIGMA_FILE_KEY */
  file?: string;
  /** Figma 節點 ID；省略時退回 FIGMA_NODE_ID */
  node?: string;
  /** 目標框架（vue3 / nuxt / react / next） */
  framework: string;
  /** 樣式引擎（tailwind / css） */
  style: StyleMode;
  /** 輸出目錄；省略則印到 stdout */
  out?: string;
}

/**
 * 控制中心的核心管線：抓取並清洗 Figma 節點 → 依框架分流產生器 → 輸出程式碼。
 *
 * Figma token 一律取自環境變數（`FIGMA_PERSONAL_ACCESS_TOKEN`，置於 .env）；
 * file / node 可由參數覆寫，否則退回對應環境變數。
 *
 * @throws 缺少 file / node / token 時丟出明確錯誤（步驟 3 會改以互動式問答補齊）。
 */
export async function runGenerate(opts: GenerateRunOptions): Promise<void> {
  const fileKey = opts.file ?? process.env.FIGMA_FILE_KEY;
  const nodeId = opts.node ?? process.env.FIGMA_NODE_ID;
  const token = process.env.FIGMA_PERSONAL_ACCESS_TOKEN;

  if (!fileKey || !nodeId || !token) {
    const missing = [
      !fileKey && '--file（或 FIGMA_FILE_KEY）',
      !nodeId && '--node（或 FIGMA_NODE_ID）',
      !token && 'FIGMA_PERSONAL_ACCESS_TOKEN（需置於 .env）',
    ]
      .filter(Boolean)
      .join('、');
    throw new Error(`缺少必要參數：${missing}`);
  }

  // mapping.config.json 位於 monorepo 根目錄
  const config: MappingConfig = JSON.parse(
    readFileSync(resolve(process.cwd(), 'mapping.config.json'), 'utf-8'),
  );

  console.log('[Core] 產生器啟動，抓取並清洗 Figma 節點...');
  const ui = await parseFigmaNode(fileKey, nodeId, token);
  console.log(`[Core] 清洗完成：${ui.name}（${ui.type}），子節點 ${ui.children.length} 個`);

  // 一鍵分流：依 framework 取得對應產生器，產出可寫入檔案的程式碼字串。
  const generator = createGenerator(opts.framework);
  const code = generator.generateComponent(ui, {
    styleMode: opts.style,
    // MappingConfig 結構相容，僅補上對外的寬鬆型別。
    mappingConfig: config as unknown as Record<string, unknown>,
  });
  const relPath = `${generator.getOutputDir(ui)}/${generator.getFileName(ui)}`;

  // 4. Prettier 格式化（讓拼接出的原始字串變成縮排整齊的可讀程式碼）
  const formattedCode = await formatCode(code, generator.getFileName(ui));

  if (opts.out) {
    // 指定 --out 時實際寫檔到 <out>/<outputDir>/<fileName>
    const target = resolve(process.cwd(), opts.out, relPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, formattedCode, 'utf-8');
    console.log(`\n🎉 目標框架：${opts.framework}（style: ${opts.style}）→ 已寫入 ${target}`);
  } else {
    // 未指定 --out 時印到 stdout
    console.log(`\n[Core] 目標框架：${opts.framework}（style: ${opts.style}）→ ${relPath}`);
    console.log(formattedCode);
  }
}
