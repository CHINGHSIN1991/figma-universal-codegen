import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CssStrategy, TailwindStrategy } from './style-strategy.js';

test('TailwindStrategy: flexDirection, gap, and padding mappings', () => {
  const strategy = new TailwindStrategy();

  // Test case 1: flex direction and gap
  const tokens1 = {
    flexDirection: 'column' as const,
    gap: 16,
  };
  assert.equal(strategy.parse(tokens1), 'flex flex-col gap-4');

  // Test case 2: uniform padding
  const tokens2 = {
    flexDirection: 'row' as const,
    padding: { top: 8, right: 8, bottom: 8, left: 8 },
  };
  assert.equal(strategy.parse(tokens2), 'flex flex-row p-2');

  // Test case 3: asymmetric padding
  const tokens3 = {
    padding: { top: 4, right: 8, bottom: 12, left: 16 },
  };
  assert.equal(strategy.parse(tokens3), 'pt-1 pr-2 pb-3 pl-4');
});

test('TailwindStrategy: non-scale spacing falls back to arbitrary values', () => {
  const strategy = new TailwindStrategy();

  // 5px / 4 = 1.25、18px / 4 = 4.5 皆不在 spacing scale 上 → 任意值語法
  assert.equal(strategy.parse({ gap: 5 }), 'gap-[5px]');
  assert.equal(
    strategy.parse({ padding: { top: 18, right: 18, bottom: 18, left: 18 } }),
    'p-[18px]',
  );
  assert.equal(
    strategy.parse({ padding: { top: 4, right: 5, bottom: 8, left: 18 } }),
    'pt-1 pr-[5px] pb-2 pl-[18px]',
  );

  // 10px / 4 = 2.5 是合法半格級距 → 維持級距 class
  assert.equal(strategy.parse({ gap: 10 }), 'gap-2.5');
});

test('TailwindStrategy: arbitrary color values with spaces use underscores', () => {
  const strategy = new TailwindStrategy();

  assert.equal(
    strategy.parse({ backgroundColor: 'rgba(26, 43, 60, 0.5)' }),
    'bg-[rgba(26,_43,_60,_0.5)]',
  );
  assert.equal(strategy.parse({ color: 'rgba(255, 0, 0, 0.8)' }), 'text-[rgba(255,_0,_0,_0.8)]');
  // 無空格的 hex 色值不受影響
  assert.equal(strategy.parse({ backgroundColor: '#1a2b3c' }), 'bg-[#1a2b3c]');
});

test('CssStrategy: flexDirection, gap, and padding mappings to standard CSS', () => {
  const strategy = new CssStrategy();

  // Test case 1: flex direction and gap
  const tokens1 = {
    flexDirection: 'column' as const,
    gap: 16,
  };
  assert.equal(strategy.parse(tokens1), 'display: flex; flex-direction: column; gap: 16px;');

  // Test case 2: uniform padding
  const tokens2 = {
    flexDirection: 'row' as const,
    padding: { top: 8, right: 8, bottom: 8, left: 8 },
  };
  assert.equal(strategy.parse(tokens2), 'display: flex; flex-direction: row; padding: 8px;');

  // Test case 3: asymmetric padding
  const tokens3 = {
    padding: { top: 4, right: 8, bottom: 12, left: 16 },
  };
  assert.equal(strategy.parse(tokens3), 'padding: 4px 8px 12px 16px;');
});
