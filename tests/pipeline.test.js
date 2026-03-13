/**
 * Tests for apps/angry-agent/lib/pipeline.js
 *
 * Run with: node apps/angry-agent/tests/pipeline.test.js
 */

const assert = require('assert');

const { analyzeIncident } = require('../lib/pipeline');

// Test helper
function test(name, fn) {
  return fn().then(
    () => { console.log(`  ✓ ${name}`); return true; },
    (err) => { console.log(`  ✗ ${name}`); console.log(`    Error: ${err.message}`); return false; },
  );
}

// --- Mock data ---

const validInput = {
  summary: 'API latency spike after config change to connection pool settings',
};

const validAnalystData = {
  hypothesis: 'Connection pool misconfiguration caused exhaustion under load',
  confidence: 'high',
  evidenceFor: ['Config change directly preceded the latency spike'],
  evidenceGaps: ['No memory profiling data'],
  reasoning: 'The config reduced max pool size from 50 to 5, causing queuing under normal load',
  alternativeCauses: ['Upstream service degradation'],
};

const validCounterData = {
  counterHypothesis: 'Upstream DNS resolution latency increased, causing pool exhaustion as a secondary effect',
  weaknesses: ['Analyst assumed config was the sole trigger without checking DNS'],
  blindSpots: ['DNS resolution times were not examined'],
  disconfirmingChecks: [
    { check: 'Query DNS resolution latency during incident window', whatItWouldProve: 'If DNS was slow, pool exhaustion is a symptom not a cause' },
  ],
  assumptions: ['Config change correlation implies causation'],
  alternativeExplanation: 'DNS provider had a regional blip at the same time as the config deploy',
};

const validSynthesisData = {
  rankedHypotheses: [
    { hypothesis: 'Connection pool misconfiguration', confidence: 'high', supportedBy: 'analyst' },
    { hypothesis: 'DNS resolution latency', confidence: 'medium', supportedBy: 'angryAgent' },
  ],
  missingEvidence: [
    { what: 'DNS resolution latency logs', how: 'Query DNS provider dashboard', priority: 'critical' },
  ],
  safestNextActions: [
    { action: 'Revert connection pool config to previous values', risk: 'low', rationale: 'Reversible and addresses most likely cause' },
  ],
  incidentBrief: 'API latency spiked after a config change. Most likely cause is pool misconfiguration. DNS issues are a plausible alternative. Recommend reverting config while investigating DNS.',
  consensusLevel: 'partial-agreement',
};

// --- Mock client factories ---

function createMockClient(responses) {
  let callIndex = 0;
  return {
    sendPromptForJson: async () => {
      const response = responses[callIndex];
      callIndex++;
      if (response instanceof Error) {
        throw response;
      }
      return { data: response, usage: { inputTokens: 100, outputTokens: 200 } };
    },
  };
}

// --- Tests ---

async function runTests() {
  console.log('\n=== Testing pipeline.js ===\n');

  let passed = 0;
  let failed = 0;

  // --- Happy path ---

  console.log('Happy path:');

  if (await test('returns full analysis with all three stages', async () => {
    const client = createMockClient([validAnalystData, validCounterData, validSynthesisData]);
    const result = await analyzeIncident(validInput, { client });

    assert.strictEqual(result.ok, true);
    assert.deepStrictEqual(result.analyst, validAnalystData);
    assert.deepStrictEqual(result.angryAgent, validCounterData);
    assert.deepStrictEqual(result.synthesis, validSynthesisData);
    assert.ok(result.error === null || result.error === undefined);
  })) passed++; else failed++;

  if (await test('includes metadata with token counts and timing', async () => {
    const client = createMockClient([validAnalystData, validCounterData, validSynthesisData]);
    const result = await analyzeIncident(validInput, { client });

    assert.ok(result.metadata);
    assert.strictEqual(typeof result.metadata.totalTokens, 'number');
    assert.ok(result.metadata.totalTokens > 0);
    assert.strictEqual(typeof result.metadata.durationMs, 'number');
    assert.ok(result.metadata.durationMs >= 0);
    assert.ok(result.metadata.timestamp);
  })) passed++; else failed++;

  if (await test('includes input in result', async () => {
    const client = createMockClient([validAnalystData, validCounterData, validSynthesisData]);
    const result = await analyzeIncident(validInput, { client });

    assert.deepStrictEqual(result.input, validInput);
  })) passed++; else failed++;

  // --- Input validation ---

  console.log('\nInput validation:');

  if (await test('rejects invalid input (missing summary)', async () => {
    const client = createMockClient([]);
    const result = await analyzeIncident({}, { client });

    assert.strictEqual(result.ok, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('validation') || result.error.includes('invalid') || result.error.includes('Input'));
  })) passed++; else failed++;

  if (await test('rejects input with summary too short', async () => {
    const client = createMockClient([]);
    const result = await analyzeIncident({ summary: 'short' }, { client });

    assert.strictEqual(result.ok, false);
    assert.ok(result.error);
  })) passed++; else failed++;

  // --- Analyst failure ---

  console.log('\nAnalyst failure:');

  if (await test('returns error when Analyst call fails completely', async () => {
    const client = createMockClient([new Error('API rate limited')]);
    const result = await analyzeIncident(validInput, { client });

    assert.strictEqual(result.ok, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Analyst'));
    assert.strictEqual(result.analyst, null);
    assert.strictEqual(result.angryAgent, null);
    assert.strictEqual(result.synthesis, null);
  })) passed++; else failed++;

  // --- Analyst returns invalid schema ---

  console.log('\nSchema validation:');

  if (await test('returns error when Analyst output fails schema validation', async () => {
    const badAnalyst = { hypothesis: 'Something', confidence: 'maybe' }; // invalid enum + missing fields
    const client = createMockClient([badAnalyst]);
    const result = await analyzeIncident(validInput, { client });

    assert.strictEqual(result.ok, false);
    assert.ok(result.error);
    assert.ok(result.error.includes('Analyst') || result.error.includes('schema') || result.error.includes('validation'));
  })) passed++; else failed++;

  // --- Angry Agent failure (partial result) ---

  console.log('\nPartial failure (Angry Agent):');

  if (await test('returns partial result when Angry Agent fails', async () => {
    const client = createMockClient([validAnalystData, new Error('Angry Agent API error')]);
    const result = await analyzeIncident(validInput, { client });

    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.analyst, validAnalystData);
    assert.strictEqual(result.angryAgent, null);
    assert.strictEqual(result.synthesis, null);
    assert.ok(result.error);
    assert.ok(result.error.includes('Angry Agent') || result.error.includes('angryAgent'));
  })) passed++; else failed++;

  if (await test('returns partial result when Angry Agent output fails validation', async () => {
    const badCounter = { counterHypothesis: 'Alt cause' }; // missing required fields
    const client = createMockClient([validAnalystData, badCounter]);
    const result = await analyzeIncident(validInput, { client });

    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.analyst, validAnalystData);
    assert.strictEqual(result.angryAgent, null);
    assert.strictEqual(result.synthesis, null);
    assert.ok(result.error);
  })) passed++; else failed++;

  // --- Synthesizer failure (partial result) ---

  console.log('\nPartial failure (Synthesizer):');

  if (await test('returns partial result when Synthesizer fails', async () => {
    const client = createMockClient([validAnalystData, validCounterData, new Error('Synthesizer timeout')]);
    const result = await analyzeIncident(validInput, { client });

    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.analyst, validAnalystData);
    assert.deepStrictEqual(result.angryAgent, validCounterData);
    assert.strictEqual(result.synthesis, null);
    assert.ok(result.error);
    assert.ok(result.error.includes('Synthesizer') || result.error.includes('synthesis'));
  })) passed++; else failed++;

  if (await test('returns partial result when Synthesizer output fails validation', async () => {
    const badSynthesis = { rankedHypotheses: [], safestNextActions: [] }; // fails minItems
    const client = createMockClient([validAnalystData, validCounterData, badSynthesis]);
    const result = await analyzeIncident(validInput, { client });

    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(result.analyst, validAnalystData);
    assert.deepStrictEqual(result.angryAgent, validCounterData);
    assert.strictEqual(result.synthesis, null);
    assert.ok(result.error);
  })) passed++; else failed++;

  // --- Token aggregation ---

  console.log('\nMetadata:');

  if (await test('aggregates tokens across all three calls', async () => {
    const client = createMockClient([validAnalystData, validCounterData, validSynthesisData]);
    const result = await analyzeIncident(validInput, { client });

    // 3 calls × (100 input + 200 output) = 900
    assert.strictEqual(result.metadata.totalTokens, 900);
  })) passed++; else failed++;

  if (await test('aggregates tokens for partial results', async () => {
    const client = createMockClient([validAnalystData, new Error('fail')]);
    const result = await analyzeIncident(validInput, { client });

    // Only 1 successful call: 100 + 200 = 300
    assert.strictEqual(result.metadata.totalTokens, 300);
  })) passed++; else failed++;

  // --- Summary ---

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
