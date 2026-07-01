import { GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';

/**
 * AI 分析後對單一節點提出的優化建議（執行期驗證用 schema）。
 *
 * 以 zod schema 作為單一來源，型別由 `z.infer` 推導，確保執行期驗證與編譯期型別一致。
 *
 * - `suggestedName`：依子節點語意重新命名為 PascalCase 元件名稱（例如 `ProductCard`）
 * - `extractedStates`：若偵測到 Table / Form / Input，列出應綁定的 state 變數名稱
 */
export const AIActionPlanSchema = z.object({
  nodeId: z.string(),
  suggestedName: z.string(),
  extractedStates: z.array(z.string()).optional(),
});

/** {@link AIActionPlanSchema} 推導出的型別。 */
export type AIActionPlan = z.infer<typeof AIActionPlanSchema>;

/** AI 回傳的完整優化建議陣列 schema。 */
const AIActionPlanListSchema = z.array(AIActionPlanSchema);

/**
 * 呼叫 Gemini 分析 UINode AST，回傳結構化的優化建議陣列。
 *
 * 雙重防線：
 * 1. `responseSchema` 強制 AI 回傳純 JSON，避免夾帶「Here is your config:」等自然語言廢話。
 * 2. `JSON.parse` 後再以 zod 驗證結構，即使 Gemini 破壞了 schema 約束也會即時擋下。
 *
 * @param simplifiedASTString - 已精簡（移除雜訊欄位）的 UINode JSON 字串
 */
export async function analyzeUIWithAI(simplifiedASTString: string): Promise<AIActionPlan[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('環境變數 GEMINI_API_KEY 未設定，無法呼叫 Gemini API。');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', // 速度快且支援 Structured Outputs 的智慧模型
    contents: `你是一個資深前端架構師。請分析下方由 Figma 轉出的 UI_AST JSON 結構，找出那些命名模糊（如 Frame 1、Rectangle 等）的節點，並依據其子節點的語意，重新給予大寫駝峰（PascalCase）的前端組件名稱。另外，如果發現 Table、Form 或 Input 節點，請提取出它們應該具備的 state 變數名稱。\n\n${simplifiedASTString}`,
    config: {
      // 強制回傳純 JSON，搭配 responseSchema 構成雙重防線
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            nodeId: { type: Type.STRING },
            suggestedName: { type: Type.STRING },
            extractedStates: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['nodeId', 'suggestedName'],
        },
      },
    },
  });

  const parsed: unknown = JSON.parse(response.text ?? '[]');
  return AIActionPlanListSchema.parse(parsed);
}

