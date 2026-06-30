import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UINode } from '@codegen/shared';
import { NextGenerator } from './index.js';

const emptyConfig: Record<string, unknown> = { mappings: {} };

// 靜態元件：無任何互動節點。
function makeStaticAst(): UINode {
  return {
    id: '1',
    name: 'Hero',
    type: 'container',
    styles: { flexDirection: 'column' },
    children: [{ id: '2', name: 'Title', type: 'text', styles: {}, textContents: 'Hi', children: [] }],
  };
}

// 互動元件：深層子節點帶 hasClickEvent。
function makeInteractiveAst(): UINode {
  return {
    id: '1',
    name: 'Form',
    type: 'container',
    styles: {},
    children: [
      {
        id: '2',
        name: 'Submit',
        type: 'component',
        styles: {},
        hasClickEvent: true,
        children: [],
      },
    ],
  };
}

test('含 hasClickEvent → 檔案最頂端注入 use client 指令', () => {
  const out = new NextGenerator().generateComponent(makeInteractiveAst(), {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });

  // 'use client' 必須是第一行，且先於 import React
  assert.match(out, /^'use client';\n\nimport React from 'react';/);
});

test('無互動節點 → 不注入 use client（維持 RSC，第一行為 import）', () => {
  const out = new NextGenerator().generateComponent(makeStaticAst(), {
    styleMode: 'tailwind',
    mappingConfig: emptyConfig,
  });

  assert.doesNotMatch(out, /use client/);
  assert.match(out, /^import React from 'react';/);
});

test('getFileName：page 節點強制為 page.tsx', () => {
  const pageAst: UINode = { id: '1', name: 'Home Page', type: 'page', styles: {}, children: [] };
  assert.equal(new NextGenerator().getFileName(pageAst), 'page.tsx');
});

test('getFileName：一般元件用 PascalCase 命名', () => {
  const componentAst: UINode = { id: '1', name: 'hero card', type: 'container', styles: {}, children: [] };
  assert.equal(new NextGenerator().getFileName(componentAst), 'HeroCard.tsx');
});

test('frameworkName 為 next、副檔名為 .tsx', () => {
  const gen = new NextGenerator();
  assert.equal(gen.frameworkName, 'next');
  assert.equal(gen.getFileExtension(), '.tsx');
});
