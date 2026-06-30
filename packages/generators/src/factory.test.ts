import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGenerator, SUPPORTED_FRAMEWORKS } from './factory.js';
import { Vue3Generator } from './vue3/index.js';
import { NuxtGenerator } from './nuxt/index.js';
import { ReactGenerator } from './react/index.js';
import { NextGenerator } from './next/index.js';

test('createGenerator 依框架名稱回傳對應實例', () => {
  assert.ok(createGenerator('vue3') instanceof Vue3Generator);
  assert.ok(createGenerator('nuxt') instanceof NuxtGenerator);
  assert.ok(createGenerator('react') instanceof ReactGenerator);
  assert.ok(createGenerator('next') instanceof NextGenerator);
});

test('createGenerator 對不支援的框架丟出明確錯誤', () => {
  assert.throws(() => createGenerator('svelte'), /不支援的框架/);
});

test('SUPPORTED_FRAMEWORKS 每個值都能成功建立產生器', () => {
  for (const fw of SUPPORTED_FRAMEWORKS) {
    assert.equal(createGenerator(fw).frameworkName, fw);
  }
});
