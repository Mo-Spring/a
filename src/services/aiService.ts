import { GoogleGenAI } from "@google/genai";
import { AIConfig } from "../types";

export async function getAIResponse(prompt: string, config: AIConfig, history: { role: string; content: string }[]) {
  const envGeminiKey = process.env.GEMINI_API_KEY;
  
  if (config.provider === 'gemini' || (!config.apiKey && envGeminiKey)) {
    const apiKeyToUse = (config.provider === 'gemini' && config.apiKey) ? config.apiKey : envGeminiKey;
    
    if (!apiKeyToUse) {
      throw new Error("Gemini API Key is missing. Please configure it in settings.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey: apiKeyToUse });
      
      const contents = [
        ...history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }],
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ];

      const response = await ai.models.generateContent({
        model: config.model || "gemini-3-flash-preview",
        contents,
        config: {
          systemInstruction: "你是一个专业的A股及港股投资分析助手，擅长行业分析、估值分析、DCF模型等。请用中文简洁回答。",
          maxOutputTokens: 1000,
        },
      });

      return response.text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }

  if (config.apiKey && config.apiUrl) {
    try {
      const response = await fetch(`${config.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: '你是一个专业的A股及港股投资分析助手，擅长行业分析、估值分析、DCF模型等。请用中文简洁回答。' },
            ...history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        return data.choices[0].message.content;
      } else {
        throw new Error(data.error?.message || 'AI Request Failed');
      }
    } catch (error) {
      console.error("Custom AI API Error:", error);
      throw error;
    }
  }

  throw new Error("AI configuration missing. Please check settings.");
}
