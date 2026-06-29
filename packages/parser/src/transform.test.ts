import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FigmaNode } from '@codegen/shared';
import { transformToUINode } from './index.js';

// 用 as unknown as FigmaNode 建立帶有 raw 欄位的假節點（含我們不需要的雜訊欄位）。
function fakeNode(partial: Record<string, unknown>): FigmaNode {
  return partial as unknown as FigmaNode;
}

test('Auto Layout frame：對應 flexDirection / gap / padding / 對齊 / 背景色 / 圓角', () => {
  const node = fakeNode({
    id: '1:1',
    name: 'Card',
    type: 'FRAME',
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    paddingTop: 8,
    paddingRight: 12,
    paddingBottom: 8,
    paddingLeft: 12,
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
    cornerRadius: 4,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } }],
    // 雜訊欄位，應被丟棄
    miterLimit: 4,
    scrollBehavior: 'SCROLLS',
  });

  const ui = transformToUINode(node);

  assert.equal(ui.type, 'container');
  assert.equal(ui.styles.flexDirection, 'row');
  assert.equal(ui.styles.gap, 16);
  assert.deepEqual(ui.styles.padding, { top: 8, right: 12, bottom: 8, left: 12 });
  assert.equal(ui.styles.justifyContent, 'space-between');
  assert.equal(ui.styles.alignItems, 'center');
  assert.equal(ui.styles.borderRadius, 4);
  assert.equal(ui.styles.backgroundColor, '#ffffff');
  // 雜訊不應出現在輸出
  assert.equal(Object.prototype.hasOwnProperty.call(ui.styles, 'miterLimit'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(ui.styles, 'scrollBehavior'), false);
});

test('TEXT 節點：type=text、帶 textContents、fill 視為文字色、字體樣式', () => {
  const node = fakeNode({
    id: '2:2',
    name: 'Title',
    type: 'TEXT',
    characters: 'Hello',
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
    style: { fontSize: 24, fontWeight: 700, textAlignHorizontal: 'CENTER' },
  });

  const ui = transformToUINode(node);

  assert.equal(ui.type, 'text');
  assert.equal(ui.textContents, 'Hello');
  assert.equal(ui.styles.color, '#000000');
  assert.equal(ui.styles.backgroundColor, undefined); // 文字節點不應有 backgroundColor
  assert.equal(ui.styles.fontSize, 24);
  assert.equal(ui.styles.fontWeight, 700);
  assert.equal(ui.styles.textAlign, 'center');
});

test('名稱含 "Button" → type=button', () => {
  const ui = transformToUINode(fakeNode({ id: '3:3', name: 'SubmitButton', type: 'FRAME' }));
  assert.equal(ui.type, 'button');
});

test('Resizing：FILL/HUG 對應語意，FIXED 取 absoluteBoundingBox 像素', () => {
  const node = fakeNode({
    id: '4:4',
    name: 'Row',
    type: 'FRAME',
    layoutSizingHorizontal: 'FILL',
    layoutSizingVertical: 'FIXED',
    absoluteBoundingBox: { width: 999, height: 48 },
  });

  const ui = transformToUINode(node);

  assert.equal(ui.styles.width, 'fill');
  assert.equal(ui.styles.height, 48); // FIXED → 取實際像素
});

test('遞迴處理子節點', () => {
  const node = fakeNode({
    id: '5:0',
    name: 'Parent',
    type: 'FRAME',
    children: [
      { id: '5:1', name: 'ChildText', type: 'TEXT', characters: 'Hi' },
      { id: '5:2', name: 'OkButton', type: 'FRAME' },
    ],
  });

  const ui = transformToUINode(node);

  assert.equal(ui.children.length, 2);
  assert.equal(ui.children[0].type, 'text');
  assert.equal(ui.children[0].textContents, 'Hi');
  assert.equal(ui.children[1].type, 'button');
});

test('半透明 fill → 輸出 rgba()', () => {
  const node = fakeNode({
    id: '6:6',
    name: 'Overlay',
    type: 'FRAME',
    fills: [{ type: 'SOLID', opacity: 0.5, color: { r: 0, g: 0, b: 0, a: 1 } }],
  });

  const ui = transformToUINode(node);
  assert.equal(ui.styles.backgroundColor, 'rgba(0, 0, 0, 0.5)');
});
