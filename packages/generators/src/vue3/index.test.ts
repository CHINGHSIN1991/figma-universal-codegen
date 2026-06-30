import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UINode } from '@codegen/shared';
import { Vue3Generator } from './index.js';

// 共用的測試 AST：一個垂直容器，內含一段文字與一個已映射的自訂按鈕。
function makeAst(): UINode {
  return {
    id: '1',
    name: 'Root',
    type: 'container',
    styles: { flexDirection: 'column', gap: 16 },
    children: [
      {
        id: '2',
        name: 'Title',
        type: 'text',
        styles: { fontSize: 24, fontWeight: 700 },
        textContents: 'Hello',
        children: [],
      },
      {
        id: '3',
        name: 'PrimaryButton',
        type: 'component',
        styles: {},
        // 模擬 Parser 已完成映射的情形
        targetComponent: 'BaseButton',
        importPath: '@/components/ui/button',
        children: [],
      },
    ],
  };
}

// 不帶任何映射規則的設定：所有節點都會退回 HTML 標籤。
// 以 Record<string, unknown> 型別宣告以符合 GenerateOptions.mappingConfig。
const emptyConfig: Record<string, unknown> = { mappings: {} };

test('tailwind 模式輸出 class 屬性並收集自訂元件 import', () => {
  const out = new Vue3Generator().generateComponent(makeAst(), {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });

  // 含 script setup 區塊與去重後的 import
  assert.match(out, /<script setup lang="ts">/);
  assert.match(out, /import BaseButton from '@\/components\/ui\/button';/);

  // 容器樣式轉為 Tailwind class
  assert.match(out, /<div class="flex flex-col gap-4">/);

  // 文字節點以已映射標籤渲染並帶入文字
  assert.match(out, /<BaseButton \/>/);
  assert.match(out, />Hello</);
});

test('css 模式改輸出 style 屬性，且無 import 時省略 script 區塊', () => {
  const ast: UINode = {
    id: '1',
    name: 'Box',
    type: 'container',
    styles: { backgroundColor: '#fff' },
    children: [],
  };
  const out = new Vue3Generator().generateComponent(ast, {
    styleMode: 'css',
    mappingConfig: emptyConfig,
  });

  assert.doesNotMatch(out, /<script/);
  assert.match(out, /<div style="background-color: #fff;" \/>/);
});

test('文字內容做 HTML 轉義以避免破壞模板', () => {
  const ast: UINode = {
    id: '1',
    name: 'Label',
    type: 'text',
    styles: {},
    textContents: '<b> & {{x}}',
    children: [],
  };
  const out = new Vue3Generator().generateComponent(ast, {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });

  assert.match(out, /&lt;b&gt; &amp; &#123;&#123;x\}\}/);
});
