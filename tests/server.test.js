/**
 * Tests for apps/angry-agent/server.js API routes.
 *
 * Uses Hono's built-in test client (no real HTTP server needed).
 *
 * Run with: node apps/angry-agent/tests/server.test.js
 */

const assert = require('assert');

const { app } = require('../server');

// Test helper (async)
function test(name, fn) {
  return fn().then(
    () => { console.log(`  ✓ ${name}`); return true; },
    (err) => { console.log(`  ✗ ${name}`); console.log(`    Error: ${err.message}`); return false; },
  );
}

async function runTests() {
  console.log('\n=== Testing server.js API routes ===\n');

  let passed = 0;
  let failed = 0;

  // --- Health ---

  console.log('GET /api/health:');

  if (await test('returns 200 with status ok', async () => {
    const res = await app.request('/api/health');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.status, 'ok');
  })) passed++; else failed++;

  // --- Samples list ---

  console.log('\nGET /api/samples:');

  if (await test('returns 200 with array of samples', async () => {
    const res = await app.request('/api/samples');
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body));
    assert.ok(body.length >= 3);
    assert.ok(body[0].id);
    assert.ok(body[0].title);
    assert.strictEqual(body[0].summary, undefined, 'list should not include summary');
  })) passed++; else failed++;

  // --- Sample by id ---

  console.log('\nGET /api/samples/:id:');

  if (await test('returns 200 with full sample for valid id', async () => {
    const listRes = await app.request('/api/samples');
    const list = await listRes.json();
    const firstId = list[0].id;

    const res = await app.request(`/api/samples/${firstId}`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.id, firstId);
    assert.ok(body.summary);
  })) passed++; else failed++;

  if (await test('returns 404 for unknown sample id', async () => {
    const res = await app.request('/api/samples/nonexistent-id');
    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.ok(body.error);
  })) passed++; else failed++;

  // --- Analyze ---

  console.log('\nPOST /api/analyze:');

  if (await test('returns 422 for invalid input (missing summary)', async () => {
    const res = await app.request('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(body.error);
  })) passed++; else failed++;

  if (await test('returns 422 for invalid input (summary too short)', async () => {
    const res = await app.request('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'short' }),
    });
    assert.strictEqual(res.status, 422);
    const body = await res.json();
    assert.ok(body.error);
  })) passed++; else failed++;

  if (await test('returns 503 when ANTHROPIC_API_KEY is not set', async () => {
    // Temporarily clear the key
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const res = await app.request('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'Database connection pool exhausted after deploy to production' }),
    });

    // Restore
    if (saved) process.env.ANTHROPIC_API_KEY = saved;

    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.ok(body.error);
    assert.ok(body.error.includes('API key') || body.error.includes('ANTHROPIC'));
  })) passed++; else failed++;

  if (await test('returns 400 for non-JSON body', async () => {
    const res = await app.request('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    });
    assert.ok([400, 422].includes(res.status));
    const body = await res.json();
    assert.ok(body.error);
  })) passed++; else failed++;

  // --- Summary ---

  console.log(`\n  Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
