/**
 * lib/gemini.ts
 * Gemini API client for Lecta Study Assistant.
 * Uses the Gemini REST API directly — no Node.js SDK needed in React Native.
 */

import Constants from 'expo-constants';

const MODELS_TO_TRY = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
];

const DEFAULT_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ||'';

// Study-focused system prompt
const SYSTEM_INSTRUCTION = `You are Lecta's Study Assistant — a friendly, expert academic tutor for university students.

Your capabilities:
- Summarize lecture notes and textbook chapters clearly
- Explain complex concepts in simple, easy-to-understand language
- Generate quiz questions and flashcards for any topic
- Create personalized study plans and revision schedules
- Help with assignments, essays, and problem sets
- Answer questions across all university subjects

Your personality:
- Warm, encouraging, and patient
- Concise but thorough — give the right amount of detail
- Use bullet points, numbered lists, and structure when it helps clarity
- Always motivate the student to keep going

Important: Never refuse to help with legitimate academic topics. If you're unsure about something, say so honestly and suggest where the student can look for more information.`;

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
}

export interface GeminiAttachment {
  mimeType: string;
  base64Data?: string;
  fileName?: string;
}

/**
 * Call the Gemini API with automatic model failover and full multi-turn memory.
 * @param history - Array of previous messages in the conversation
 * @param userMessage - The latest user message
 * @param attachment - Optional image or document attachment
 * @returns The AI response text
 */
export async function callGemini(
  history: GeminiMessage[],
  userMessage: string,
  attachment?: GeminiAttachment
): Promise<string> {
  const apiKey =
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_GEMINI_API_KEY ||
    DEFAULT_KEY;

  const userParts: any[] = [];
  if (attachment && attachment.base64Data) {
    const mime = (attachment.mimeType || '').toLowerCase();
    const isSupportedInline =
      mime.startsWith('image/') ||
      mime.startsWith('text/') ||
      mime.startsWith('audio/') ||
      mime.startsWith('video/') ||
      mime === 'application/pdf';

    if (isSupportedInline) {
      userParts.push({
        inlineData: {
          mimeType: attachment.mimeType || 'image/jpeg',
          data: attachment.base64Data,
        },
      });
    } else {
      userMessage = `[Attached File: ${attachment.fileName || 'document'}]\n\n${userMessage}`;
    }
  }
  userParts.push({ text: userMessage || 'Please analyze this study attachment.' });

  // Build the contents array (conversation history + new user message)
  const contents = [
    ...history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.text }],
    })),
    {
      role: 'user',
      parts: userParts,
    },
  ];

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_INSTRUCTION }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  let lastError: Error | null = null;

  // Try each model in sequence for maximum reliability
  for (const modelName of MODELS_TO_TRY) {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.warn(`Gemini [${modelName}] returned status ${response.status}:`, errorBody);
        
        // If it's a 503 (high demand) or 404 (model moved), try the next model
        if (response.status === 503 || response.status === 404 || response.status === 429) {
          lastError = new Error(`Model ${modelName} temporarily busy (${response.status})`);
          continue;
        }

        if (response.status === 400 || response.status === 403) {
          throw new Error('Invalid Gemini API Key or request parameters.');
        }

        lastError = new Error(`Gemini error (${response.status})`);
        continue;
      }

      const data = await response.json();
      const candidate = data?.candidates?.[0];

      if (candidate?.finishReason === 'SAFETY') {
        throw new Error('Your message was flagged by safety filters. Please rephrase it.');
      }

      const text = candidate?.content?.parts?.[0]?.text;
      if (text && text.trim()) {
        return text.trim();
      }
    } catch (err: any) {
      if (err.message && err.message.includes('safety')) {
        throw err;
      }
      lastError = err;
      console.warn(`Error trying ${modelName}:`, err.message);
    }
  }

  throw lastError || new Error('Unable to connect to AI study assistant. Please try again.');
}
