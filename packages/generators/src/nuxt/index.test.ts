import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UINode } from '@codegen/shared';
import { NuxtGenerator } from './index.js';

// 共用的測試 AST
function makeComponentAst(): UINode {
  return {
    id: '1',
    name: 'Root',
    type: 'container',
    styles: { flexDirection: 'column', gap: 16 },
    children: [
      {
        id: '2',
        name: 'PrimaryButton',
        type: 'component',
        styles: {},
        targetComponent: 'BaseButton',
        importPath: '@/components/ui/button',
        children: [],
      },
    ],
  };
}

function makePageAst(): UINode {
  return {
    id: '1',
    name: 'HomePage',
    type: 'page',
    styles: {},
    children: [],
  };
}

const emptyConfig: Record<string, unknown> = { mappings: {} };

test('NuxtGenerator：預設開啟 autoImport，不寫入自訂元件的 import 語句且省略 script setup', () => {
  const out = new NuxtGenerator().generateComponent(makeComponentAst(), {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });

  // 應該沒有 script setup
  assert.doesNotMatch(out, /<script/);
  assert.doesNotMatch(out, /import BaseButton/);
  // 元件 tag 仍應正常渲染
  assert.match(out, /<BaseButton \/>/);
});

test('NuxtGenerator：若 autoImport 設為 false，則應該寫入 import 語句與 script setup', () => {
  const out = new NuxtGenerator({ autoImport: false }).generateComponent(makeComponentAst(), {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });

  // 應該有 script setup 與 import 語句
  assert.match(out, /<script setup lang="ts">/);
  assert.match(out, /import BaseButton from '@\/components\/ui\/button';/);
  assert.match(out, /<BaseButton \/>/);
});

test('NuxtGenerator：getOutputDir 判斷', () => {
  const generator = new NuxtGenerator();

  const componentAst = makeComponentAst();
  const pageAst = makePageAst();

  // 一般元件應該放入 'components' 目錄
  assert.equal(generator.getOutputDir(componentAst), 'components');

  // 頁面元件應該放入 'pages' 目錄
  assert.equal(generator.getOutputDir(pageAst), 'pages');
});
