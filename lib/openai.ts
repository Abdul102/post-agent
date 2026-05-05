import OpenAI from 'openai';

let _client: OpenAI | null = null;

/**
 * Returns an OpenAI-compatible client.
 *
 * Works with any provider that implements the OpenAI Chat Completions API:
 *  - OpenAI       (default): set OPENAI_API_KEY only
 *  - Groq (FREE):  OPENAI_BASE_URL=https://api.groq.com/openai/v1
 *                  OPENAI_API_KEY=<groq key>
 *                  OPENAI_MODEL=llama-3.3-70b-versatile
 *  - Together AI:  OPENAI_BASE_URL=https://api.together.xyz/v1
 *  - OpenRouter:   OPENAI_BASE_URL=https://openrouter.ai/api/v1
 */
export function getOpenAI(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Add it to your .env file.');
    }
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return _client;
}

export const TEXT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
