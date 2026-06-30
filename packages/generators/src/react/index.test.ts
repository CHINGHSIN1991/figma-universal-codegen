import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UINode } from '@codegen/shared';
import { ReactGenerator } from './index.js';

// 共用的測試 AST：垂直容器，內含一段文字與一個已映射的自訂按鈕。
function makeAst(): UINode {
  return {
    id: '1',
    name: 'Card',
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
        targetComponent: 'BaseButton',
        importPath: '@/components/ui/button',
        children: [],
      },
    ],
  };
}

const emptyConfig: Record<string, unknown> = { mappings: {} };

test('tailwind 模式輸出 className 並收集具名 import 與函數元件骨架', () => {
  const out = new ReactGenerator().generateComponent(makeAst(), {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });

  // React 執行階段引入與自訂元件的具名 import
  assert.match(out, /^import React from 'react';/);
  assert.match(out, /import \{ BaseButton \} from '@\/components\/ui\/button';/);

  // 具名函數元件骨架
  assert.match(out, /export function Card\(\) \{/);
  assert.match(out, /return \(/);

  // 容器樣式轉為 className
  assert.match(out, /<div className="flex flex-col gap-4">/);
  // 自訂元件自閉合
  assert.match(out, /<BaseButton \/>/);
  assert.match(out, />Hello</);
});

test('css 模式輸出 React inline style 物件（camelCase）', () => {
  const ast: UINode = {
    id: '1',
    name: 'Box',
    type: 'container',
    styles: { flexDirection: 'column', fontSize: 20 },
    children: [],
  };
  const out = new ReactGenerator().generateComponent(ast, {
    styleMode: 'css',
    mappingConfig: emptyConfig,
  });

  // 應為 style={{ ... }} 物件，且屬性 camelCase、值為字串
  assert.match(out, /style=\{\{ display: 'flex', flexDirection: 'column', fontSize: '20px' \}\}/);
  assert.doesNotMatch(out, /className=/);
});

test('元件名稱正規化為合法 PascalCase 識別字', () => {
  const ast: UINode = { id: '1', name: 'home page 01', type: 'page', styles: {}, children: [] };
  const out = new ReactGenerator().generateComponent(ast, {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });
  assert.match(out, /export function HomePage01\(\) \{/);
});

test('JSX 文字轉義：< > & { } 轉為 HTML 實體', () => {
  const ast: UINode = {
    id: '1',
    name: 'Label',
    type: 'text',
    styles: {},
    textContents: '<b> & {x}',
    children: [],
  };
  const out = new ReactGenerator().generateComponent(ast, {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });
  assert.match(out, /&lt;b&gt; &amp; &#123;x&#125;/);
});

test('getFileExtension 回傳 .tsx', () => {
  assert.equal(new ReactGenerator().getFileExtension(), '.tsx');
});
