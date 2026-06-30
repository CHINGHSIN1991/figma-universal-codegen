/**
 * 控制中心「一鍵分流」示範（免 Figma 憑證）。
 *
 * 用一組手寫的 UINode AST 模擬 Parser 清洗後的標準中介資料，
 * 透過 {@link createGenerator} 分流到各框架產生器，印出產出的程式碼。
 *
 * 用法：
 *   pnpm demo                                  # 跑遍所有支援的框架
 *   CODEGEN_FRAMEWORK=react pnpm demo          # 只跑單一框架
 *   CODEGEN_STYLE=css pnpm demo                # 改用 inline / css 樣式
 */
import { GenerateOptions, UINode } from '@codegen/shared';
import { createGenerator, SUPPORTED_FRAMEWORKS } from '@codegen/generators';

// 模擬 Parser 產出的標準中介資料（UINode）。
// 注意：樣式放在 `styles`（UIStyleToken，框架無關），而非 className 字串；
// PrimaryButton 不預填 targetComponent，藉此示範產生器即時查 mapping.config。
const mockAST: UINode = {
  id: '1',
  name: 'LoginPage',
  type: 'page', // 'page' → Next 會輸出成 page.tsx
  styles: {
    flexDirection: 'column',
    gap: 16,
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    backgroundColor: '#f9fafb',
  },
  children: [
    {
      id: '2',
      name: 'Title',
      type: 'text',
      styles: { fontSize: 24, fontWeight: 700, color: '#111827' },
      textContents: '會員登入',
      children: [],
    },
    {
      id: '3',
      name: 'PrimaryButton',
      type: 'component',
      styles: {
        backgroundColor: '#3b82f6',
        color: '#ffffff',
        padding: { top: 8, right: 16, bottom: 8, left: 16 },
        borderRadius: 6,
      },
      textContents: '登入',
      hasClickEvent: true, // 觸發 Next 的 'use client' 注入
      children: [],
    },
  ],
};

const options: GenerateOptions = {
  styleMode: (process.env.CODEGEN_STYLE as GenerateOptions['styleMode']) ?? 'tailwind',
  // 每個框架各自一段 importPath（key 須對應各產生器的 frameworkName）。
  mappingConfig: {
    mappings: {
      PrimaryButton: {
        targetComponent: 'BaseButton',
        vue3: { importPath: '@/components/BaseButton.vue' },
        nuxt: { importPath: '@/components/BaseButton.vue' },
        react: { importPath: '@/components/ui/button' },
        next: { importPath: '@/components/ui/button' },
      },
    },
  },
};

// 一鍵分流：可用 CODEGEN_FRAMEWORK 指定單一框架，否則全部跑一遍。
const target = process.env.CODEGEN_FRAMEWORK;
const frameworks = target ? [target] : [...SUPPORTED_FRAMEWORKS];

for (const framework of frameworks) {
  const generator = createGenerator(framework);
  const code = generator.generateComponent(mockAST, options);
  const outputPath = `${generator.getOutputDir(mockAST)}/${generator.getFileName(mockAST)}`;

  console.log('\n' + '='.repeat(64));
  console.log(`[${framework}]  style=${options.styleMode}  →  ${outputPath}`);
  console.log('='.repeat(64));
  console.log(code);
}
