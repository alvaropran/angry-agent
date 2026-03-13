/**
 * Pipeline orchestration for the Angry Agent 3-step analysis.
 *
 * Flow: Analyst → Angry Agent → Synthesizer
 * Returns partial results on failure at any stage.
 */

const {
  validateIncidentInput,
  validateAnalystHypothesis,
  validateCounterHypothesis,
  validateSynthesizedBrief,
} = require('./schemas');

const {
  buildAnalystPrompt,
  buildAngryAgentPrompt,
  buildSynthesizerPrompt,
} = require('./prompts');

function formatValidationErrors(errors) {
  return errors
    .map((e) => `${e.instancePath || '/'} ${e.message}`)
    .join('; ');
}

function makeResult({ ok, input, analyst, angryAgent, synthesis, error, usage, startTime }) {
  const totalTokens = usage.reduce(
    (sum, u) => sum + (u.inputTokens || 0) + (u.outputTokens || 0),
    0,
  );
  return {
    ok,
    input,
    analyst,
    angryAgent,
    synthesis,
    error: error || null,
    metadata: {
      totalTokens,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    },
  };
}

async function analyzeIncident(input, options = {}) {
  const { client } = options;
  const startTime = Date.now();
  const usageEntries = [];

  // --- Validate input ---
  const inputCheck = validateIncidentInput(input);
  if (!inputCheck.valid) {
    return makeResult({
      ok: false,
      input,
      analyst: null,
      angryAgent: null,
      synthesis: null,
      error: `Input validation failed: ${formatValidationErrors(inputCheck.errors)}`,
      usage: usageEntries,
      startTime,
    });
  }

  // --- Stage 1: Analyst ---
  let analystData;
  try {
    const prompt = buildAnalystPrompt(input);
    const response = await client.sendPromptForJson(prompt);
    usageEntries.push(response.usage);

    const check = validateAnalystHypothesis(response.data);
    if (!check.valid) {
      return makeResult({
        ok: false,
        input,
        analyst: null,
        angryAgent: null,
        synthesis: null,
        error: `Analyst output schema validation failed: ${formatValidationErrors(check.errors)}`,
        usage: usageEntries,
        startTime,
      });
    }
    analystData = response.data;
  } catch (err) {
    return makeResult({
      ok: false,
      input,
      analyst: null,
      angryAgent: null,
      synthesis: null,
      error: `Analyst stage failed: ${err.message}`,
      usage: usageEntries,
      startTime,
    });
  }

  // --- Stage 2: Angry Agent ---
  let counterData;
  try {
    const analystJson = JSON.stringify(analystData, null, 2);
    const prompt = buildAngryAgentPrompt(input, analystJson);
    const response = await client.sendPromptForJson(prompt);
    usageEntries.push(response.usage);

    const check = validateCounterHypothesis(response.data);
    if (!check.valid) {
      return makeResult({
        ok: false,
        input,
        analyst: analystData,
        angryAgent: null,
        synthesis: null,
        error: `Angry Agent output schema validation failed: ${formatValidationErrors(check.errors)}`,
        usage: usageEntries,
        startTime,
      });
    }
    counterData = response.data;
  } catch (err) {
    return makeResult({
      ok: false,
      input,
      analyst: analystData,
      angryAgent: null,
      synthesis: null,
      error: `Angry Agent stage failed: ${err.message}`,
      usage: usageEntries,
      startTime,
    });
  }

  // --- Stage 3: Synthesizer ---
  let synthesisData;
  try {
    const analystJson = JSON.stringify(analystData, null, 2);
    const counterJson = JSON.stringify(counterData, null, 2);
    const prompt = buildSynthesizerPrompt(input.summary, analystJson, counterJson);
    const response = await client.sendPromptForJson(prompt);
    usageEntries.push(response.usage);

    const check = validateSynthesizedBrief(response.data);
    if (!check.valid) {
      return makeResult({
        ok: false,
        input,
        analyst: analystData,
        angryAgent: counterData,
        synthesis: null,
        error: `Synthesizer output schema validation failed: ${formatValidationErrors(check.errors)}`,
        usage: usageEntries,
        startTime,
      });
    }
    synthesisData = response.data;
  } catch (err) {
    return makeResult({
      ok: false,
      input,
      analyst: analystData,
      angryAgent: counterData,
      synthesis: null,
      error: `Synthesizer stage failed: ${err.message}`,
      usage: usageEntries,
      startTime,
    });
  }

  return makeResult({
    ok: true,
    input,
    analyst: analystData,
    angryAgent: counterData,
    synthesis: synthesisData,
    error: null,
    usage: usageEntries,
    startTime,
  });
}

module.exports = { analyzeIncident };
