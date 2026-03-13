# Angry Agent

**Incident Devil's Advocate** — an AI-powered incident analysis tool that challenges your root cause assumptions before you act on them.

Paste an incident summary, logs, and metrics. Angry Agent runs three AI agents in sequence:

1. **Analyst** proposes the most likely root cause
2. **Angry Agent** tears it apart — finds blind spots, weak assumptions, and alternative explanations
3. **Synthesizer** reconciles both views and recommends the safest next actions

The result: fewer knee-jerk responses, more evidence-based incident resolution.

![Angry Agent Demo](screenshots/demo-input.png)
<!-- Replace with your own screenshot of the input form with a sample incident loaded -->

## Why

During incidents, teams anchor on the first plausible hypothesis and skip disconfirming evidence. Angry Agent forces a structured adversarial review before you act — the same way good postmortems work, but in real-time.

## Screenshots

### Input Form
Load a sample incident or paste your own context — logs, metrics, postmortem drafts.

![Input Form](screenshots/input-form.png)
<!-- Replace: screenshot of the input form with sample loaded (the cascading timeouts example works well) -->

### Hypothesis Analysis
Two competing hypotheses side by side — the analyst's primary cause and the devil's advocate counter-hypothesis.

![Hypothesis Panels](screenshots/hypothesis-panels.png)
<!-- Replace: screenshot showing the Primary Hypothesis and Counter-Hypothesis panels -->

### Evidence & Actions
Missing evidence prioritized by criticality, and safe next actions ranked by risk level.

![Evidence and Actions](screenshots/evidence-actions.png)
<!-- Replace: screenshot showing the Missing Evidence and Safe Next Actions panels -->

### Disconfirming Checks
Specific checks that could disprove the primary hypothesis — each with what the result would mean.

![Disconfirming Checks](screenshots/disconfirming-checks.png)
<!-- Replace: screenshot showing the Disconfirming Checks panel and metadata footer -->

## Quick Start

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/angry-agent.git
cd angry-agent

# Install
npm install

# Set your API key
export ANTHROPIC_API_KEY=your-key-here

# Start
npm start
# → http://localhost:3000
```

The app ships with 4 sample incidents you can load from the dropdown — no API key needed to browse them.

## How It Works

```
Input (incident context)
  │
  ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Analyst    │────▶│ Angry Agent  │────▶│ Synthesizer  │
│ (root cause) │     │ (challenges) │     │ (reconciles) │
└─────────────┘     └──────────────┘     └──────────────┘
                                                │
                                                ▼
                                    Structured JSON Response
                                    ├── Ranked hypotheses
                                    ├── Missing evidence
                                    ├── Safe next actions
                                    └── Operator-ready brief
```

Each agent's output is validated against a JSON schema before passing to the next stage. If any stage fails, you get partial results with a clear error.

## Architecture

```
angry-agent/
  server.js              # Hono server, API routes
  lib/
    schemas.js           # JSON schemas + Ajv validators
    prompts.js           # Prompt templates for all 3 agents
    pipeline.js          # Analyst → Angry Agent → Synthesizer orchestration
    claude-client.js     # Thin Anthropic SDK wrapper
    sample-incidents.js  # Demo incidents
  public/
    index.html           # Single-page UI
    style.css            # Dark theme, 4-panel grid
    app.js               # Vanilla JS fetch + render
  fixtures/              # Eval scenarios (misleading symptoms, red herrings, etc.)
  tests/                 # 86 tests across 5 suites
```

## API

All responses are JSON.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/samples` | GET | List sample incidents (id + title) |
| `/api/samples/:id` | GET | Get full sample by id |
| `/api/analyze` | POST | Run the 3-agent pipeline |

### POST /api/analyze

```json
{
  "summary": "Payment service returning 504s after deploy (required)",
  "logs": "optional log lines",
  "metrics": "optional metrics",
  "postmortemDraft": "optional existing postmortem to challenge",
  "additionalContext": "optional notes"
}
```

Returns structured analysis with `analyst`, `angryAgent`, `synthesis`, and `metadata` fields.

## Tests

```bash
npm test
```

86 tests across 5 suites: schemas, prompts, pipeline (mocked), eval fixtures, and server routes.

## Eval Fixtures

The `fixtures/` directory contains 4 evaluation scenarios:

| Fixture | Tests |
|---------|-------|
| `misleading-symptom.json` | CPU spike masks lock contention from a concurrent migration |
| `incomplete-logs.json` | 12-minute log gap hides the auth failure trigger |
| `red-herring.json` | Noisy NPEs distract from CDN cache collapse |
| `multiple-causes.json` | DB failover + cert rotation overlap with 2+ plausible causes |

## Stack

- **Runtime**: Node.js 18+
- **Server**: [Hono](https://hono.dev)
- **AI**: Claude via [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-node)
- **Validation**: [Ajv](https://ajv.js.org)
- **Frontend**: Vanilla HTML/CSS/JS (no build step)
- **Tests**: Node.js built-in `assert`

## License

MIT
