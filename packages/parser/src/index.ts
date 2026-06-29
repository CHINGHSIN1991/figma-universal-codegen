import { UINode } from '@codegen/shared';

// Placeholder：實際的 Figma → UINode 清洗邏輯為後續里程碑，先回傳最小合法節點。
export function parseFigmaNode(id: string): UINode {
  console.log(`[Parser] 正在解析 Figma 節點: ${id}`);
  return { id, name: 'Placeholder', type: 'container', styles: {}, children: [] };
}
