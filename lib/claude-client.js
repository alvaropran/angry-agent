/**
 * Thin wrapper around the Anthropic SDK for the Angry Agent pipeline.
 *
 * Handles: API calls, JSON extraction from responses, retry on malformed JSON.
 */

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

function createClaudeClient(options = {}) {
  const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required. Set it as an environment variable or pass it in options.');
  }

  // Lazy-load the SDK so tests that mock this module don't need it installed
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const model = options.model || DEFAULT_MODEL;

  async function sendPrompt(prompt) {
    const response = await client.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  function extractJson(text) {
    let cleaned = text.trim();
    // Strip markdown fences: ```json ... ``` or ``` ... ```
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
    return JSON.parse(cleaned);
  }

  async function sendPromptForJson(prompt) {
    const response = await sendPrompt(prompt);
    try {
      const parsed = extractJson(response.text);
      return { data: parsed, usage: response.usage };
    } catch (_firstError) {
      // Retry once with a follow-up asking for valid JSON
      const retryResponse = await sendPrompt(
        `Your previous response was not valid JSON. Here was your response:\n\n${response.text}\n\nPlease respond with ONLY valid JSON, no markdown fences, no extra text.`,
      );
      const parsed = extractJson(retryResponse.text);
      return {
        data: parsed,
        usage: {
          inputTokens: response.usage.inputTokens + retryResponse.usage.inputTokens,
          outputTokens: response.usage.outputTokens + retryResponse.usage.outputTokens,
        },
      };
    }
  }

  return { sendPrompt, sendPromptForJson };
}

module.exports = { createClaudeClient, DEFAULT_MODEL, MAX_TOKENS };
