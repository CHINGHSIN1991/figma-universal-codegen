import { UIStyleToken } from '@codegen/shared';

/**
 * 所有樣式轉譯器必須實作的策略介面（Strategy Pattern）。
 * 透過統一的 `parse()` 合約，讓 core 層可以在執行期切換不同的樣式輸出方式，
 * 例如：`--style tailwind` 或 `--style css`。
 */
export interface StyleStrategy {
  // 輸入清洗後的樣式 Token，輸出最終要填入標籤的字串（例如 className 或 inline-style）
  parse(tokens: UIStyleToken): string;
}

/**
 * Tailwind 的 font-weight utility class 對照表。
 * 標準 CSS 數值 → Tailwind 語意化 class name。
 * 若傳入非標準值（如 350），則 fallback 為任意值語法 `font-[350]`。
 */
const TAILWIND_FONT_WEIGHT: Record<number, string> = {
  100: 'font-thin',
  200: 'font-extralight',
  300: 'font-light',
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
  800: 'font-extrabold',
  900: 'font-black',
};

/**
 * Tailwind 預設 spacing scale 的合法級距（gap-1.5、p-14 等）。
 * Figma 間距除以 4 後若不在此集合（例如 5px → 1.25、18px → 4.5），
 * 對應的 class 並不存在，需 fallback 為任意值語法（gap-[5px]）。
 */
const TAILWIND_SPACING_STEPS = new Set([
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24,
  28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
]);

/** px 值落在 spacing scale 上輸出級距 class，否則輸出任意值語法。 */
function spacingClass(prefix: string, px: number): string {
  const step = px / 4;
  return TAILWIND_SPACING_STEPS.has(step) ? `${prefix}-${step}` : `${prefix}-[${px}px]`;
}

/**
 * Tailwind 任意值語法中不允許空格（會被當成 class 分隔符），
 * 依官方慣例以底線代替（渲染 CSS 時 Tailwind 會將 `_` 還原為空格）。
 * 例：`rgba(26, 43, 60, 0.5)` → `rgba(26,_43,_60,_0.5)`。
 */
function arbitraryValue(value: string): string {
  return value.replace(/\s+/g, '_');
}

/**
 * 將 UIStyleToken 轉換為 Tailwind CSS utility class 字串。
 *
 * 設計說明：
 * - Figma 數值單位為 px，Tailwind 的間距級距以 4px 為一單位（spacing scale）。
 *   因此 gap / padding 需除以 4 轉換（例：16px → gap-4）。
 * - width / height 的 Figma Resizing 模式：
 *     `fill` → 撐滿父容器 → `w-full`
 *     `hug`  → 包裹內容  → `w-fit`
 *     數字   → 固定尺寸  → Tailwind 任意值語法 `w-[Npx]`
 * - 顏色與 borderRadius 使用 Tailwind 任意值語法（`bg-[#hex]`、`rounded-[Npx]`）
 *   以支援 Figma 設計稿中的任意數值，無需對應到預設的 Tailwind 色盤。
 */
export class TailwindStrategy implements StyleStrategy {
  parse(tokens: UIStyleToken): string {
    const classes: string[] = [];

    // --- 版面（Auto Layout） ---

    // flexDirection 決定主軸方向；有方向才需要宣告 flex
    if (tokens.flexDirection) {
      classes.push('flex');
      if (tokens.flexDirection === 'column') classes.push('flex-col');
      if (tokens.flexDirection === 'row') classes.push('flex-row');
    }

    // 主軸對齊（對應 Figma primaryAxisAlignItems）
    if (tokens.justifyContent) {
      const map: Record<string, string> = {
        start: 'justify-start',
        center: 'justify-center',
        end: 'justify-end',
        'space-between': 'justify-between',
      };
      classes.push(map[tokens.justifyContent]);
    }

    // 交叉軸對齊（對應 Figma counterAxisAlignItems）
    if (tokens.alignItems) {
      const map: Record<string, string> = {
        start: 'items-start',
        center: 'items-center',
        end: 'items-end',
      };
      classes.push(map[tokens.alignItems]);
    }

    // Figma 數值轉 Tailwind 級距（16px → gap-4）；不在級距上則用任意值（5px → gap-[5px]）
    if (tokens.gap) {
      classes.push(spacingClass('gap', tokens.gap));
    }

    // 四邊相等時輸出 `p-N`，否則逐邊輸出（16px → p-4）
    if (tokens.padding) {
      const { top, right, bottom, left } = tokens.padding;
      if (top === right && right === bottom && bottom === left) {
        classes.push(spacingClass('p', top));
      } else {
        classes.push(
          [
            spacingClass('pt', top),
            spacingClass('pr', right),
            spacingClass('pb', bottom),
            spacingClass('pl', left),
          ].join(' '),
        );
      }
    }

    // --- 尺寸 ---

    // fill → 撐滿父容器；hug → 包裹內容；數字 → 任意值固定寬度
    if (tokens.width !== undefined) {
      if (tokens.width === 'fill') classes.push('w-full');
      else if (tokens.width === 'hug') classes.push('w-fit');
      else classes.push(`w-[${tokens.width}px]`);
    }

    if (tokens.height !== undefined) {
      if (tokens.height === 'fill') classes.push('h-full');
      else if (tokens.height === 'hug') classes.push('h-fit');
      else classes.push(`h-[${tokens.height}px]`);
    }

    // --- 外觀 ---

    // 使用任意值語法支援 Figma 任意色票（`bg-[#1a2b3c]`）；
    // rgba() 等含空格的色值需經 arbitraryValue 轉底線，否則 class 會被空格拆散。
    if (tokens.backgroundColor) {
      classes.push(`bg-[${arbitraryValue(tokens.backgroundColor)}]`);
    }

    if (tokens.borderRadius !== undefined) {
      classes.push(`rounded-[${tokens.borderRadius}px]`);
    }

    // --- 文字 ---

    if (tokens.color) {
      classes.push(`text-[${arbitraryValue(tokens.color)}]`);
    }

    if (tokens.fontSize !== undefined) {
      classes.push(`text-[${tokens.fontSize}px]`);
    }

    // 對照語意化 class；非標準值 fallback 為任意值語法（`font-[350]`）
    if (tokens.fontWeight !== undefined) {
      classes.push(TAILWIND_FONT_WEIGHT[tokens.fontWeight] ?? `font-[${tokens.fontWeight}]`);
    }

    if (tokens.textAlign) {
      classes.push(`text-${tokens.textAlign}`);
    }

    return classes.join(' ');
  }
}

/**
 * 將 UIStyleToken 轉換為內聯 CSS 樣式字串（適用於 style 屬性或 .css 檔案）。
 *
 * 設計說明：
 * - UIStyleToken 的對齊值（`start` / `end`）需映射為 CSS 的 `flex-start` / `flex-end`，
 *   因為 CSS Flexbox 不接受裸字 `start`（那是 CSS Grid 的語法）。
 * - width / height 的 Figma Resizing 模式：
 *     `fill` → `100%`（撐滿父容器）
 *     `hug`  → `fit-content`（包裹內容）
 *     數字   → `Npx`（固定尺寸）
 */
export class CssStrategy implements StyleStrategy {
  parse(tokens: UIStyleToken): string {
    const styles: string[] = [];

    // --- 版面（Auto Layout） ---

    if (tokens.flexDirection) {
      styles.push('display: flex;');
      styles.push(`flex-direction: ${tokens.flexDirection};`);
    }

    // UIStyleToken 的 `start`/`end` 需映射為 CSS Flexbox 的 `flex-start`/`flex-end`
    if (tokens.justifyContent) {
      const map: Record<string, string> = {
        start: 'flex-start',
        center: 'center',
        end: 'flex-end',
        'space-between': 'space-between',
      };
      styles.push(`justify-content: ${map[tokens.justifyContent]};`);
    }

    if (tokens.alignItems) {
      const map: Record<string, string> = {
        start: 'flex-start',
        center: 'center',
        end: 'flex-end',
      };
      styles.push(`align-items: ${map[tokens.alignItems]};`);
    }

    if (tokens.gap !== undefined) {
      styles.push(`gap: ${tokens.gap}px;`);
    }

    // 四邊相等時輸出簡寫，否則輸出四值簡寫
    if (tokens.padding) {
      const { top, right, bottom, left } = tokens.padding;
      if (top === right && right === bottom && bottom === left) {
        styles.push(`padding: ${top}px;`);
      } else {
        styles.push(`padding: ${top}px ${right}px ${bottom}px ${left}px;`);
      }
    }

    // --- 尺寸 ---

    if (tokens.width !== undefined) {
      if (tokens.width === 'fill') styles.push('width: 100%;');
      else if (tokens.width === 'hug') styles.push('width: fit-content;');
      else styles.push(`width: ${tokens.width}px;`);
    }

    if (tokens.height !== undefined) {
      if (tokens.height === 'fill') styles.push('height: 100%;');
      else if (tokens.height === 'hug') styles.push('height: fit-content;');
      else styles.push(`height: ${tokens.height}px;`);
    }

    // --- 外觀 ---

    if (tokens.backgroundColor) {
      styles.push(`background-color: ${tokens.backgroundColor};`);
    }

    if (tokens.borderRadius !== undefined) {
      styles.push(`border-radius: ${tokens.borderRadius}px;`);
    }

    // --- 文字 ---

    if (tokens.color) {
      styles.push(`color: ${tokens.color};`);
    }

    if (tokens.fontSize !== undefined) {
      styles.push(`font-size: ${tokens.fontSize}px;`);
    }

    if (tokens.fontWeight !== undefined) {
      styles.push(`font-weight: ${tokens.fontWeight};`);
    }

    if (tokens.textAlign) {
      styles.push(`text-align: ${tokens.textAlign};`);
    }

    return styles.join(' ');
  }
}
