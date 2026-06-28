import { parseFigmaNode } from '@codegen/parser';

function main() {
  console.log('[Core] 產生器啟動...');
  const result = parseFigmaNode('102:333');
  console.log('[Core] 成功抓取測試 AST 節點：', result);
}

main();
