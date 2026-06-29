import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFigmaNodes } from './figma-api.js';

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
  mockFetch({ nodes: { '1:23': { document: { name: 'Card', type: 'FRAME' } } } }, { status: 200 });

  const doc = await fetchFigmaNodes('FILE', '1:23', 'TOKEN');

  assert.equal(doc.name, 'Card');
  assert.equal(doc.type, 'FRAME');
});

test('node id 用 "-" 時，會 fallback 到 ":" 格式查找', async () => {
  // 呼叫端傳網址格式的 "402-485"，但 API 回傳的 key 是 "402:485"。
  mockFetch({ nodes: { '402:485': { document: { name: 'Desktop' } } } }, { status: 200 });

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
