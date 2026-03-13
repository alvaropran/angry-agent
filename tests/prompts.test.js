/**
 * Tests for apps/angry-agent/lib/prompts.js
 *
 * Run with: node apps/angry-agent/tests/prompts.test.js
 */

const assert = require('assert');

const {
  renderPrompt,
  buildAnalystPrompt,
  buildAngryAgentPrompt,
  buildSynthesizerPrompt,
  ANALYST_TEMPLATE,
  ANGRY_AGENT_TEMPLATE,
  SYNTHESIZER_TEMPLATE,
} = require('../lib/prompts');

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
  console.log('\n=== Testing prompts.js ===\n');

  let passed = 0;
  let failed = 0;

  // --- renderPrompt ---

  console.log('renderPrompt:');

  if (test('interpolates simple variables', () => {
    const result = renderPrompt('Hello {{name}}, you are {{role}}.', { name: 'Alice', role: 'admin' });
    assert.strictEqual(result, 'Hello Alice, you are admin.');
  })) passed++; else failed++;

  if (test('leaves unmatched variables as empty string', () => {
    const result = renderPrompt('Hello {{name}}.', {});
    assert.strictEqual(result, 'Hello .');
  })) passed++; else failed++;

  if (test('includes conditional block when variable is truthy', () => {
    const result = renderPrompt('Start.{{#if extra}} Extra: {{extra}}.{{/if}} End.', { extra: 'data' });
    assert.strictEqual(result, 'Start. Extra: data. End.');
  })) passed++; else failed++;

  if (test('removes conditional block when variable is falsy (undefined)', () => {
    const result = renderPrompt('Start.{{#if extra}} Extra: {{extra}}.{{/if}} End.', {});
    assert.strictEqual(result, 'Start. End.');
  })) passed++; else failed++;

  if (test('removes conditional block when variable is empty string', () => {
    const result = renderPrompt('Start.{{#if extra}} Extra: {{extra}}.{{/if}} End.', { extra: '' });
    assert.strictEqual(result, 'Start. End.');
  })) passed++; else failed++;

  if (test('handles multiple conditional blocks', () => {
    const template = '{{#if a}}A:{{a}}{{/if}} {{#if b}}B:{{b}}{{/if}}';
    const result = renderPrompt(template, { a: 'yes', b: '' });
    assert.strictEqual(result, 'A:yes ');
  })) passed++; else failed++;

  if (test('handles multiline conditional blocks', () => {
    const template = 'Header\n{{#if logs}}\nLogs:\n{{logs}}\n{{/if}}\nFooter';
    const result = renderPrompt(template, { logs: 'line1\nline2' });
    assert.ok(result.includes('Logs:\nline1\nline2'));
    assert.ok(result.includes('Footer'));
  })) passed++; else failed++;

  if (test('removes multiline conditional block when falsy', () => {
    const template = 'Header\n{{#if logs}}\nLogs:\n{{logs}}\n{{/if}}\nFooter';
    const result = renderPrompt(template, {});
    assert.ok(!result.includes('Logs:'));
    assert.ok(result.includes('Header'));
    assert.ok(result.includes('Footer'));
  })) passed++; else failed++;

  // --- buildAnalystPrompt ---

  console.log('\nbuildAnalystPrompt:');

  if (test('includes summary in output', () => {
    const result = buildAnalystPrompt({ summary: 'Database connection pool exhausted' });
    assert.ok(result.includes('Database connection pool exhausted'));
  })) passed++; else failed++;

  if (test('includes logs section when logs provided', () => {
    const result = buildAnalystPrompt({
      summary: 'API timeout',
      logs: 'ERROR: connection refused',
    });
    assert.ok(result.includes('ERROR: connection refused'));
    assert.ok(result.includes('Logs:'));
  })) passed++; else failed++;

  if (test('omits logs section when logs not provided', () => {
    const result = buildAnalystPrompt({ summary: 'API timeout' });
    assert.ok(!result.includes('Logs:'));
  })) passed++; else failed++;

  if (test('omits metrics section when metrics not provided', () => {
    const result = buildAnalystPrompt({ summary: 'API timeout' });
    assert.ok(!result.includes('Metrics:'));
  })) passed++; else failed++;

  if (test('includes all optional sections when provided', () => {
    const result = buildAnalystPrompt({
      summary: 'Incident',
      logs: 'some logs',
      metrics: 'p99 latency spiked',
      postmortemDraft: 'initial draft',
      additionalContext: 'deployed at 9am',
    });
    assert.ok(result.includes('Logs:'));
    assert.ok(result.includes('Metrics:'));
    assert.ok(result.includes('postmortem draft:'));
    assert.ok(result.includes('Additional context:'));
  })) passed++; else failed++;

  if (test('includes JSON output format instructions', () => {
    const result = buildAnalystPrompt({ summary: 'Incident' });
    assert.ok(result.includes('"hypothesis"'));
    assert.ok(result.includes('"confidence"'));
    assert.ok(result.includes('JSON'));
  })) passed++; else failed++;

  if (test('returns a string', () => {
    const result = buildAnalystPrompt({ summary: 'test' });
    assert.strictEqual(typeof result, 'string');
  })) passed++; else failed++;

  // --- buildAngryAgentPrompt ---

  console.log('\nbuildAngryAgentPrompt:');

  const sampleAnalystOutput = JSON.stringify({
    hypothesis: 'Connection pool leak',
    confidence: 'high',
    evidenceFor: ['Logs show pool exhaustion'],
    reasoning: 'Deploy introduced unclosed handles',
  });

  if (test('includes incident summary', () => {
    const result = buildAngryAgentPrompt(
      { summary: 'DB pool exhaustion after deploy' },
      sampleAnalystOutput,
    );
    assert.ok(result.includes('DB pool exhaustion after deploy'));
  })) passed++; else failed++;

  if (test('includes analyst hypothesis JSON', () => {
    const result = buildAngryAgentPrompt(
      { summary: 'Incident' },
      sampleAnalystOutput,
    );
    assert.ok(result.includes('Connection pool leak'));
    assert.ok(result.includes(sampleAnalystOutput));
  })) passed++; else failed++;

  if (test('includes adversarial instructions', () => {
    const result = buildAngryAgentPrompt(
      { summary: 'Incident' },
      sampleAnalystOutput,
    );
    assert.ok(result.includes('challenge') || result.includes('CHALLENGE') || result.includes('devil'));
  })) passed++; else failed++;

  if (test('includes counter-hypothesis output format', () => {
    const result = buildAngryAgentPrompt(
      { summary: 'Incident' },
      sampleAnalystOutput,
    );
    assert.ok(result.includes('"counterHypothesis"'));
    assert.ok(result.includes('"weaknesses"'));
    assert.ok(result.includes('"disconfirmingChecks"'));
  })) passed++; else failed++;

  if (test('omits logs section when not provided', () => {
    const result = buildAngryAgentPrompt(
      { summary: 'Incident' },
      sampleAnalystOutput,
    );
    assert.ok(!result.includes('Logs:'));
  })) passed++; else failed++;

  // --- buildSynthesizerPrompt ---

  console.log('\nbuildSynthesizerPrompt:');

  const sampleCounterOutput = JSON.stringify({
    counterHypothesis: 'DNS failure',
    weaknesses: ['Assumed deploy causation'],
    blindSpots: ['No DNS metrics checked'],
    disconfirmingChecks: [{ check: 'Query DNS times', whatItWouldProve: 'Pool exhaustion is a symptom' }],
  });

  if (test('includes incident summary', () => {
    const result = buildSynthesizerPrompt('Incident summary', sampleAnalystOutput, sampleCounterOutput);
    assert.ok(result.includes('Incident summary'));
  })) passed++; else failed++;

  if (test('includes both hypothesis JSONs', () => {
    const result = buildSynthesizerPrompt('Incident', sampleAnalystOutput, sampleCounterOutput);
    assert.ok(result.includes(sampleAnalystOutput));
    assert.ok(result.includes(sampleCounterOutput));
  })) passed++; else failed++;

  if (test('includes safety principles', () => {
    const result = buildSynthesizerPrompt('Incident', sampleAnalystOutput, sampleCounterOutput);
    assert.ok(result.includes('rollback') || result.includes('Rollback'));
    assert.ok(result.includes('reversible') || result.includes('Reversible'));
  })) passed++; else failed++;

  if (test('includes synthesized brief output format', () => {
    const result = buildSynthesizerPrompt('Incident', sampleAnalystOutput, sampleCounterOutput);
    assert.ok(result.includes('"rankedHypotheses"'));
    assert.ok(result.includes('"safestNextActions"'));
    assert.ok(result.includes('"incidentBrief"'));
  })) passed++; else failed++;

  // --- Template exports exist ---

  console.log('\nTemplate exports:');

  if (test('ANALYST_TEMPLATE is a non-empty string', () => {
    assert.strictEqual(typeof ANALYST_TEMPLATE, 'string');
    assert.ok(ANALYST_TEMPLATE.length > 100);
  })) passed++; else failed++;

  if (test('ANGRY_AGENT_TEMPLATE is a non-empty string', () => {
    assert.strictEqual(typeof ANGRY_AGENT_TEMPLATE, 'string');
    assert.ok(ANGRY_AGENT_TEMPLATE.length > 100);
  })) passed++; else failed++;

  if (test('SYNTHESIZER_TEMPLATE is a non-empty string', () => {
    assert.strictEqual(typeof SYNTHESIZER_TEMPLATE, 'string');
    assert.ok(SYNTHESIZER_TEMPLATE.length > 100);
  })) passed++; else failed++;

  // --- Summary ---

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
