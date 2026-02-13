
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Transaction, CSPLog } from "../types";

// Helper to initialize the GenAI client
const getAi = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Standard business analysis using Flash for speed
 */
export const getStoreInsights = async (transactions: Transaction[], cspLogs: CSPLog[]) => {
  const ai = getAi();
  const summary = {
    totalSales: transactions.reduce((acc, curr) => acc + curr.amount, 0),
    cspVolume: cspLogs.reduce((acc, curr) => acc + curr.amount, 0),
    totalCommission: cspLogs.reduce((acc, curr) => acc + curr.commission, 0),
    transactionCount: transactions.length + cspLogs.length,
  };

  const prompt = `Analyze "Laddu Kirana & General Store" performance: ${JSON.stringify(summary)}. Provide 3 actionable insights in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  impact: { type: Type.STRING }
                },
                required: ["title", "description", "impact"]
              }
            }
          },
          required: ["insights"]
        }
      }
    });
    return JSON.parse(response.text || '{"insights": []}');
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return { insights: [] };
  }
};

/**
 * Advanced Chatbot with Thinking and Search capabilities
 */
export const chatWithAi = async (params: {
  message: string;
  image?: string;
  useThinking?: boolean;
  useSearch?: boolean;
}) => {
  const ai = getAi();
  const { message, image, useThinking, useSearch } = params;

  // Use Pro for complex tasks/thinking/images, Flash for search-grounded quick queries
  const model = (useThinking || image) ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
  
  const contents: any[] = [];
  if (image) {
    contents.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: image.split(',')[1],
      },
    });
  }
  contents.push({ text: message });

  const config: any = {
    systemInstruction: "You are the AI Assistant for Laddu Kirana & General Store. Help users with inventory questions, store data analysis, or general queries. Be professional and concise.",
  };

  if (useThinking && model === 'gemini-3-pro-preview') {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  if (useSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts: contents },
      config,
    });
    
    let sourceUrls: string[] = [];
    if (useSearch) {
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        sourceUrls = chunks.map((c: any) => c.web?.uri).filter(Boolean);
      }
    }

    return { 
      text: response.text || "I'm sorry, I couldn't generate a response.",
      sources: sourceUrls 
    };
  } catch (error) {
    console.error("Gemini chat failed:", error);
    return { text: "Connection error. Please check your network and try again." };
  }
};

/**
 * Text-to-Speech using Gemini 2.5 Flash
 */
export const speakText = async (text: string) => {
  const ai = getAi();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say naturally: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (error) {
    console.error("Gemini TTS failed:", error);
    return null;
  }
};
