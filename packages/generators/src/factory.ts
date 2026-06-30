import { BaseGenerator } from '@codegen/shared';
import { Vue3Generator } from './vue3/index.js';
import { NuxtGenerator } from './nuxt/index.js';
import { ReactGenerator } from './react/index.js';
import { NextGenerator } from './next/index.js';

/** 目前支援分流的框架清單（對應 mapping.config.json 的 key 與 CLI 的 --framework 參數）。 */
export const SUPPORTED_FRAMEWORKS = ['vue3', 'nuxt', 'react', 'next'] as const;

export type Framework = (typeof SUPPORTED_FRAMEWORKS)[number];

/**
 * 產生器工廠（控制中心的「一鍵分流」核心）。
 * 依框架名稱回傳對應的 {@link BaseGenerator} 實例，讓 CLI／Core 不必認識各框架細節，
 * 只要拿到 generator 就能呼叫 `.generateComponent()`。
 *
 * @throws 若傳入不支援的框架名稱。
 */
export function createGenerator(framework: string): BaseGenerator {
  switch (framework) {
    case 'vue3':
      return new Vue3Generator();
    case 'nuxt':
      return new NuxtGenerator();
    case 'react':
      return new ReactGenerator();
    case 'next':
      return new NextGenerator();
    default:
      throw new Error(
        `不支援的框架：「${framework}」（可選：${SUPPORTED_FRAMEWORKS.join(' / ')}）`,
      );
  }
}
