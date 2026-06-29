const FIGMA_API_BASE = 'https://api.figma.com/v1';

/**
 * 從 Figma API 取得指定節點的原始 document tree。
 *
 * Figma 的 /files/:key/nodes API 回傳的不是截圖，而是包含圖層名稱、
 * AutoLayout 排版方向、間距（Gap）、文字內容、色彩編碼等極度詳細的
 * 元數據（Metadata）。回傳結構非常深，這裡先取出該節點的 document 原始 tree。
 *
 * @param fileKey Figma 檔案 key（網址中 /file/<key>/ 的部分）
 * @param nodeId  目標節點 id（網址中 ?node-id=<id>，例如 "1:23"）
 * @param token   Figma personal access token
 * @returns       該節點的 document 原始 tree
 */
export async function fetchFigmaNodes(
  fileKey: string,
  nodeId: string,
  token: string,
): Promise<any> {
  const url = `${FIGMA_API_BASE}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;

  // 使用 Node 內建的原生 fetch（Node 18+；Node 24 已為穩定版，無實驗警告）。
  const response = await fetch(url, {
    headers: { 'X-Figma-Token': token },
  });
  // fetch 不會對非 2xx 自動拋錯，需自行檢查。
  if (!response.ok) {
    throw new Error(`Figma API 回傳 ${response.status} ${response.statusText}（fileKey: ${fileKey}）`);
  }
  const data = await response.json();

  // Figma 網址中的 node id 用 "-"（例如 402-485），但 API 回傳的 key 用 ":"（402:485）。
  // 兩種格式都嘗試查找，讓呼叫端可以直接貼網址上的 id。
  const nodes = data?.nodes ?? {};
  const node = nodes[nodeId] ?? nodes[nodeId.replace(/-/g, ':')];
  if (!node?.document) {
    throw new Error(
      `Figma 回傳中找不到節點 "${nodeId}"（fileKey: ${fileKey}）。請確認 node id 與權限是否正確。`,
    );
  }

  return node.document;
}
