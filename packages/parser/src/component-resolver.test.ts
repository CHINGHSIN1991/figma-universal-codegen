import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveComponentTag, MappingConfig } from './component-resolver.js';

const config: MappingConfig = {
  mappings: {
    PrimaryButton: {
      targetComponent: 'BaseButton',
      vue3: { importPath: '@/components/base/BaseButton.vue' },
      react: { importPath: '@/components/ui/button' },
    },
  },
};

test('resolveComponentTag: 命中 mapping 時回傳自訂元件與 importPath', () => {
  assert.deepEqual(resolveComponentTag('PrimaryButton', 'react', config), {
    isCustomComponent: true,
    tag: 'BaseButton',
    importPath: '@/components/ui/button',
  });
});

test('resolveComponentTag: 衍生框架退回基底框架的 mapping（next → react、nuxt → vue3）', () => {
  assert.deepEqual(resolveComponentTag('PrimaryButton', 'next', config), {
    isCustomComponent: true,
    tag: 'BaseButton',
    importPath: '@/components/ui/button',
  });
  assert.deepEqual(resolveComponentTag('PrimaryButton', 'nuxt', config), {
    isCustomComponent: true,
    tag: 'BaseButton',
    importPath: '@/components/base/BaseButton.vue',
  });
});

test('resolveComponentTag: 命中名稱但該框架無 importPath 時退回 HTML 標籤', () => {
  const svelteResult = resolveComponentTag('PrimaryButton', 'svelte', config);
  assert.deepEqual(svelteResult, {
    isCustomComponent: false,
    tag: 'div',
    importPath: null,
  });
});

test('resolveComponentTag: 未命中 mapping 時退回 HTML 語意標籤', () => {
  assert.deepEqual(resolveComponentTag('HeroSection', 'react', config), {
    isCustomComponent: false,
    tag: 'div',
    importPath: null,
  });
  assert.deepEqual(resolveComponentTag('BodyText', 'react', config), {
    isCustomComponent: false,
    tag: 'span',
    importPath: null,
  });
});
