import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TailwindStrategy } from './style-strategy.js';

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
