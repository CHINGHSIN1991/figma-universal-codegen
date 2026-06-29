import { UIStyleToken } from '@codegen/shared';

export interface StyleStrategy {
  // 輸入清洗後的樣式 Token，輸出最終要填入標籤的字串（例如 className 或 inline-style）
  parse(tokens: UIStyleToken): string;
}

export class TailwindStrategy implements StyleStrategy {
  parse(tokens: UIStyleToken): string {
    const classes: string[] = [];

    if (tokens.flexDirection) {
      classes.push('flex');
      if (tokens.flexDirection === 'column') classes.push('flex-col');
      if (tokens.flexDirection === 'row') classes.push('flex-row');
    }

    // Figma 數值轉 Tailwind 級距 (16px -> gap-4)
    if (tokens.gap) {
      const tailwindGap = tokens.gap / 4;
      classes.push(`gap-${tailwindGap}`);
    }

    // 處理內邊距 Padding
    if (tokens.padding) {
      const { top, right, bottom, left } = tokens.padding;
      if (top === right && right === bottom && bottom === left) {
        classes.push(`p-${top / 4}`);
      } else {
        classes.push(`pt-${top / 4} pr-${right / 4} pb-${bottom / 4} pl-${left / 4}`);
      }
    }
    return classes.join(' ');
  }
}

export class CssStrategy implements StyleStrategy {
  parse(tokens: UIStyleToken): string {
    const styles: string[] = [];

    if (tokens.flexDirection) {
      styles.push('display: flex;');
      styles.push(`flex-direction: ${tokens.flexDirection};`);
    }

    if (tokens.gap !== undefined) {
      styles.push(`gap: ${tokens.gap}px;`);
    }

    if (tokens.padding) {
      const { top, right, bottom, left } = tokens.padding;
      if (top === right && right === bottom && bottom === left) {
        styles.push(`padding: ${top}px;`);
      } else {
        styles.push(`padding: ${top}px ${right}px ${bottom}px ${left}px;`);
      }
    }

    return styles.join(' ');
  }
}
