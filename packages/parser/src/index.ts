import { TestAST } from '@codegen/shared';

export function parseFigmaNode(id: string): TestAST {
  console.log(`[Parser] 正在解析 Figma 節點: ${id}`);
  return { id, type: 'FRAME' };
}
