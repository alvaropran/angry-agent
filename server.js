/**
 * Angry Agent — Hono server.
 *
 * Start: ANTHROPIC_API_KEY=sk-... node apps/angry-agent/server.js
 * Sample endpoints work without an API key.
 */

const path = require('path');
const { Hono } = require('hono');
const { serveStatic } = require('@hono/node-server/serve-static');

const { validateIncidentInput } = require('./lib/schemas');
const { analyzeIncident } = require('./lib/pipeline');
const { createClaudeClient } = require('./lib/claude-client');
const { getSample, listSamples } = require('./lib/sample-incidents');

const app = new Hono();

// --- API routes ---

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.get('/api/samples', (c) => c.json(listSamples()));

app.get('/api/samples/:id', (c) => {
  const sample = getSample(c.req.param('id'));
  if (!sample) {
    return c.json({ error: 'Sample not found' }, 404);
  }
  return c.json(sample);
});

app.post('/api/analyze', async (c) => {
  // Parse body
  let body;
  try {
    body = await c.req.json();
  } catch (_err) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Validate input
  const check = validateIncidentInput(body);
  if (!check.valid) {
    const details = check.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
    return c.json({ error: `Input validation failed: ${details}` }, 422);
  }

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return c.json({ error: 'ANTHROPIC_API_KEY is not set. Set it as an environment variable to enable analysis.' }, 503);
  }

  // Run pipeline
  try {
    const client = createClaudeClient();
    const result = await analyzeIncident(body, { client });
    const status = result.ok ? 200 : 207; // 207 Multi-Status for partial results
    return c.json(result, status);
  } catch (err) {
    return c.json({ error: `Analysis failed: ${err.message}` }, 500);
  }
});

// --- Static files (frontend) ---

app.use(
  '/*',
  serveStatic({
    root: path.relative(process.cwd(), path.join(__dirname, 'public')),
  }),
);

// --- Start server (only when run directly, not when imported for tests) ---

if (require.main === module) {
  const { serve } = require('@hono/node-server');
  const port = parseInt(process.env.PORT || '3000', 10);
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Angry Agent running at http://localhost:${port}`);
    if (!process.env.ANTHROPIC_API_KEY) {
      console.log('  ⚠ ANTHROPIC_API_KEY not set — sample endpoints work, analysis disabled');
    }
  });
}

module.exports = { app };
