/**
 * Tests for apps/angry-agent/lib/schemas.js
 *
 * Run with: node apps/angry-agent/tests/schemas.test.js
 */

const assert = require('assert');

// Import the module under test
const {
  validateIncidentInput,
  validateAnalystHypothesis,
  validateCounterHypothesis,
  validateSynthesizedBrief,
} = require('../lib/schemas');

// Test helper
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function runTests() {
  console.log('\n=== Testing schemas.js ===\n');

  let passed = 0;
  let failed = 0;

  // --- IncidentInput ---

  console.log('IncidentInput:');

  if (test('accepts valid input with only summary', () => {
    const result = validateIncidentInput({ summary: 'Database connection pool exhausted after deploy' });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors, null);
  })) passed++; else failed++;

  if (test('accepts valid input with all fields', () => {
    const result = validateIncidentInput({
      summary: 'API latency spike after config change',
      logs: '2024-01-15T10:00:00Z ERROR connection timeout\n2024-01-15T10:00:01Z ERROR pool exhausted',
      metrics: 'p99 latency: 200ms -> 5000ms over 10 minutes',
      postmortemDraft: 'Initial assessment: config change caused connection leak',
      additionalContext: 'Deploy happened at 09:55 UTC',
    });
    assert.strictEqual(result.valid, true);
  })) passed++; else failed++;

  if (test('rejects missing summary', () => {
    const result = validateIncidentInput({});
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  })) passed++; else failed++;

  if (test('rejects summary shorter than 10 chars', () => {
    const result = validateIncidentInput({ summary: 'too short' });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects extra properties', () => {
    const result = validateIncidentInput({
      summary: 'Valid incident summary here',
      unknownField: 'should not be allowed',
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects non-string summary', () => {
    const result = validateIncidentInput({ summary: 12345 });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  // --- AnalystHypothesis ---

  console.log('\nAnalystHypothesis:');

  const validAnalyst = {
    hypothesis: 'Connection pool leak caused by unclosed database handles after deploy',
    confidence: 'high',
    evidenceFor: ['Error logs show pool exhaustion starting at deploy time'],
    reasoning: 'The deploy introduced a code path that opens connections without closing them',
  };

  if (test('accepts valid analyst hypothesis', () => {
    const result = validateAnalystHypothesis(validAnalyst);
    assert.strictEqual(result.valid, true);
  })) passed++; else failed++;

  if (test('accepts analyst hypothesis with all optional fields', () => {
    const result = validateAnalystHypothesis({
      ...validAnalyst,
      evidenceGaps: ['No memory profiling data available'],
      alternativeCauses: ['Upstream service degradation'],
    });
    assert.strictEqual(result.valid, true);
  })) passed++; else failed++;

  if (test('rejects analyst hypothesis missing required fields', () => {
    const result = validateAnalystHypothesis({ hypothesis: 'Some cause' });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects invalid confidence enum', () => {
    const result = validateAnalystHypothesis({
      ...validAnalyst,
      confidence: 'maybe',
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects empty evidenceFor array', () => {
    const result = validateAnalystHypothesis({
      ...validAnalyst,
      evidenceFor: [],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  // --- CounterHypothesis ---

  console.log('\nCounterHypothesis:');

  const validCounter = {
    counterHypothesis: 'The real cause is upstream DNS resolution failure, not a connection pool leak',
    weaknesses: ['Analyst assumed the deploy was the trigger without checking DNS logs'],
    blindSpots: ['No DNS resolution metrics were examined'],
    disconfirmingChecks: [
      { check: 'Query DNS resolution times during the incident window', whatItWouldProve: 'If DNS was slow, the pool exhaustion is a symptom not a cause' },
    ],
  };

  if (test('accepts valid counter hypothesis', () => {
    const result = validateCounterHypothesis(validCounter);
    assert.strictEqual(result.valid, true);
  })) passed++; else failed++;

  if (test('accepts counter hypothesis with all optional fields', () => {
    const result = validateCounterHypothesis({
      ...validCounter,
      assumptions: ['Analyst assumed deploy correlation implies causation'],
      alternativeExplanation: 'DNS provider had a regional outage at the same time',
    });
    assert.strictEqual(result.valid, true);
  })) passed++; else failed++;

  if (test('rejects counter hypothesis missing weaknesses', () => {
    const result = validateCounterHypothesis({
      counterHypothesis: 'Alternative cause',
      blindSpots: ['Something missed'],
      disconfirmingChecks: [{ check: 'Check X', whatItWouldProve: 'Proves Y' }],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects empty disconfirmingChecks array', () => {
    const result = validateCounterHypothesis({
      ...validCounter,
      disconfirmingChecks: [],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects disconfirmingCheck missing whatItWouldProve', () => {
    const result = validateCounterHypothesis({
      ...validCounter,
      disconfirmingChecks: [{ check: 'Run a DNS trace' }],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  // --- SynthesizedBrief ---

  console.log('\nSynthesizedBrief:');

  const validSynthesis = {
    rankedHypotheses: [
      { hypothesis: 'Connection pool leak from deploy', confidence: 'medium', supportedBy: 'analyst' },
      { hypothesis: 'DNS resolution failure', confidence: 'medium', supportedBy: 'angryAgent' },
    ],
    missingEvidence: [
      { what: 'DNS resolution latency during incident', how: 'Query DNS provider metrics dashboard', priority: 'critical' },
    ],
    safestNextActions: [
      { action: 'Roll back the deploy', risk: 'low', rationale: 'Reversible and addresses the most likely trigger' },
    ],
    incidentBrief: 'API latency spiked after a deploy. Two hypotheses remain: connection pool leak vs DNS failure. Recommend rollback while gathering DNS metrics.',
  };

  if (test('accepts valid synthesized brief', () => {
    const result = validateSynthesizedBrief(validSynthesis);
    assert.strictEqual(result.valid, true);
  })) passed++; else failed++;

  if (test('accepts synthesized brief with consensusLevel', () => {
    const result = validateSynthesizedBrief({
      ...validSynthesis,
      consensusLevel: 'partial-agreement',
    });
    assert.strictEqual(result.valid, true);
  })) passed++; else failed++;

  if (test('rejects invalid consensusLevel enum', () => {
    const result = validateSynthesizedBrief({
      ...validSynthesis,
      consensusLevel: 'kinda-agree',
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects empty rankedHypotheses', () => {
    const result = validateSynthesizedBrief({
      ...validSynthesis,
      rankedHypotheses: [],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects empty safestNextActions', () => {
    const result = validateSynthesizedBrief({
      ...validSynthesis,
      safestNextActions: [],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects invalid priority in missingEvidence', () => {
    const result = validateSynthesizedBrief({
      ...validSynthesis,
      missingEvidence: [{ what: 'Logs', how: 'Check Splunk', priority: 'urgent' }],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  if (test('rejects invalid supportedBy enum', () => {
    const result = validateSynthesizedBrief({
      ...validSynthesis,
      rankedHypotheses: [{ hypothesis: 'X', confidence: 'high', supportedBy: 'nobody' }],
    });
    assert.strictEqual(result.valid, false);
  })) passed++; else failed++;

  // --- Summary ---

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
