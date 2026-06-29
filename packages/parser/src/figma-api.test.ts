import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFigmaNodes } from './figma-api.js';
import { parseFigmaNode } from './index.js';

// 保留原始 fetch，每個測試結束後還原，避免互相污染。
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// 把 globalThis.fetch 換成回傳固定內容的假實作（不碰網路）。
function mockFetch(body: unknown, init?: ResponseInit) {
  globalThis.fetch = async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), init);
}

test('正常回傳時回傳 node.document', async () => {
  mockFetch({ nodes: { '1:23': { document: { id: '1:23', name: 'Card', type: 'FRAME' } } } }, { status: 200 });

  const doc = await fetchFigmaNodes('FILE', '1:23', 'TOKEN');

  assert.equal(doc.name, 'Card');
  assert.equal(doc.type, 'FRAME');
});

test('node id 用 "-" 時，會 fallback 到 ":" 格式查找', async () => {
  // 呼叫端傳網址格式的 "402-485"，但 API 回傳的 key 是 "402:485"。
  mockFetch({ nodes: { '402:485': { document: { id: '402:485', name: 'Desktop', type: 'FRAME' } } } }, { status: 200 });

  const doc = await fetchFigmaNodes('FILE', '402-485', 'TOKEN');

  assert.equal(doc.name, 'Desktop');
});

test('非 2xx 回應會丟出含狀態碼的錯誤', async () => {
  mockFetch('forbidden', { status: 403, statusText: 'Forbidden' });

  await assert.rejects(
    () => fetchFigmaNodes('FILE', '1:23', 'BAD_TOKEN'),
    /403/,
  );
});

test('回傳中找不到節點時會丟錯', async () => {
  mockFetch({ nodes: {} }, { status: 200 });

  await assert.rejects(
    () => fetchFigmaNodes('FILE', '9:99', 'TOKEN'),
    /找不到節點/,
  );
});

test('回傳結構不符預期（Zod 型別防線）時會丟錯', async () => {
  // 缺少 nodes 外層，且 document 少了必要欄位 → 應被 Zod 擋下。
  mockFetch({ unexpected: true }, { status: 200 });

  await assert.rejects(
    () => fetchFigmaNodes('FILE', '1:23', 'TOKEN'),
    /結構不符預期/,
  );
});

test('parseFigmaNode：fetch → transform 串接後輸出清洗過的 UINode', async () => {
  mockFetch(
    {
      nodes: {
        '1:23': {
          document: {
            id: '1:23',
            name: 'Card',
            type: 'FRAME',
            layoutMode: 'VERTICAL',
            itemSpacing: 8,
            children: [{ id: '1:24', name: 'Title', type: 'TEXT', characters: 'Hi' }],
          },
        },
      },
    },
    { status: 200 },
  );

  const ui = await parseFigmaNode('FILE', '1:23', 'TOKEN');

  assert.equal(ui.type, 'container');
  assert.equal(ui.styles.flexDirection, 'column');
  assert.equal(ui.styles.gap, 8);
  assert.equal(ui.children[0].type, 'text');
  assert.equal(ui.children[0].textContents, 'Hi');
});
