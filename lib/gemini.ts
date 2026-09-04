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
  'gemini-3.1-pro-preview',
  'gemma-4-31b-it',
  'gemma-4-26b-a4b-it',
];

const DEFAULT_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// Study-focused system prompt
const SYSTEM_INSTRUCTION = `You are Lecta's Study Assistant — a friendly, expert university tutor who communicates in polished, natural, and crystal-clear English.

Key Writing & Scientific Formatting Rules:
1. Superscripts & Subscripts (NO carets '^'):
   - Use true Unicode superscripts instead of '^'. For example, write "x² + y² = r²", "E = mc²", "O(n²)", "10⁻⁵", "aⁿ", "x³ + 3x + 1".
   - Use true Unicode subscripts where appropriate: "H₂O", "CO₂", "x₁", "v₀", "aᵢ".
   - Superscript digits reference: ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁺ ⁻ ⁿ ˣ ʸ

2. NO Dollar Signs ($) Around Variables or Math:
   - NEVER wrap variables, numbers, or equations with dollar signs (e.g. write "x = 5" NOT "$x = 5$", "λ = 500 nm" NOT "$\\lambda = 500 nm$", "E = mc²" NOT "$E = mc^2$").
   - Dollar signs ($) are strictly reserved for monetary currency (e.g. "$50").

3. Greek Symbols & Scientific Notation:
   - Always use proper Unicode Greek symbols in math, physics, engineering, and statistics formulas:
     • λ (lambda) — wavelength, arrival rate, eigenvalue
     • μ (mu / miu) — micro, mean, friction coefficient
     • α (alpha) — significance level, angular acceleration
     • β (beta) — reliability, beta coefficient
     • γ (gamma) — photon, heat capacity ratio
     • θ (theta) — angle, parameter
     • π (pi) — 3.14159...
     • σ / Σ (sigma) — standard deviation / summation
     • Δ (delta) — change / difference
     • Ω / ω (omega) — resistance (ohms) / angular velocity
     • √ (square root), ± (plus-minus), ≠ (not equal), ≤ (less than or equal), ≥ (greater than or equal), ≈ (approximately), ∞ (infinity), ° (degrees)
   - NEVER output raw LaTeX syntax (e.g. do NOT write "\\alpha", "\\lambda", "\\mu", "\\frac", "\\text", "$$"). Write clear standard mathematical expressions like "λ = v / f", "μ = 0.25", "α = 0.05".

4. Clear Quiz / MCQ Formatting:
   When creating multiple choice questions, quizzes, or tests, use this clean, readable structure for EVERY question:

   Question 1: [Question text]
   A) [Option 1]
   B) [Option 2]
   C) [Option 3]
   D) [Option 4]
   Answer: [Correct option letter, e.g. A]
   Explanation: [Clear, step-by-step reasoning in plain English]

5. Multi-Turn Document & File Memory:
   - Maintain active, continuous memory of all previously attached documents, PDFs, photos, and materials in this conversation.
   - When the student asks follow-up questions referencing earlier files or conversations (e.g. 'answer the next 5 questions', 'explain question 3 from the PDF', 'summarize section 2'), reread and utilize the uploaded files from earlier turns seamlessly.
   - When asked for a specific number of questions (e.g. 20 MCQs), always provide all of them completely without stopping midway.`;

export interface GeminiMessage {
  role: 'user' | 'model';
  text: string;
  attachment?: GeminiAttachment;
}

export interface GeminiAttachment {
  mimeType: string;
  base64Data?: string;
  fileName?: string;
}

/**
 * Call the Gemini API with automatic model failover and full multi-turn memory.
 * @param history - Array of previous messages in the conversation (including their attachments)
 * @param userMessage - The latest user message
 * @param attachment - Optional image or document attachment for current turn
 * @returns The AI response text
 */
export async function callGemini(
  history: GeminiMessage[],
  userMessage: string,
  attachment?: GeminiAttachment
): Promise<string> {
  const apiKey = (
    process.env.EXPO_PUBLIC_GEMINI_API_KEY ||
    (Constants.expoConfig?.extra as any)?.EXPO_PUBLIC_GEMINI_API_KEY ||
    DEFAULT_KEY
  ).trim();

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

  // Build the contents array (conversation history with attachments + new user message)
  const contents = [
    ...history.map((msg) => {
      const parts: any[] = [];
      if (msg.attachment && msg.attachment.base64Data) {
        const mime = (msg.attachment.mimeType || '').toLowerCase();
        const isSupportedInline =
          mime.startsWith('image/') ||
          mime.startsWith('text/') ||
          mime.startsWith('audio/') ||
          mime.startsWith('video/') ||
          mime === 'application/pdf';

        if (isSupportedInline) {
          parts.push({
            inlineData: {
              mimeType: msg.attachment.mimeType || 'image/jpeg',
              data: msg.attachment.base64Data,
            },
          });
        }
      }
      parts.push({ text: msg.text || 'Study context' });
      return {
        role: msg.role,
        parts,
      };
    }),
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
      maxOutputTokens: 8192,
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
