/**
 * Prompt templates and rendering for the Angry Agent pipeline.
 *
 * Templates use {{variable}} for interpolation and
 * {{#if field}}...{{/if}} for conditional blocks.
 */

// --- Template Renderer ---

function renderPrompt(template, vars) {
  // Process {{#if field}}...{{/if}} conditional blocks (supports multiline)
  let result = template.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => {
      const value = vars[key];
      return (value !== undefined && value !== null && value !== '') ? content : '';
    },
  );

  // Process {{variable}} interpolation
  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (_, key) => {
      const value = vars[key];
      return (value !== undefined && value !== null) ? String(value) : '';
    },
  );

  return result;
}

// --- Prompt Templates ---

const ANALYST_TEMPLATE = `You are an expert incident analyst. Given incident evidence, determine the most likely root cause.

## Incident Context
Summary: {{summary}}
{{#if logs}}
Logs:
{{logs}}
{{/if}}
{{#if metrics}}
Metrics:
{{metrics}}
{{/if}}
{{#if postmortemDraft}}
Existing postmortem draft:
{{postmortemDraft}}
{{/if}}
{{#if additionalContext}}
Additional context:
{{additionalContext}}
{{/if}}

## Your Task
Analyze the evidence and produce your best hypothesis for the root cause.

Think step by step:
1. What symptoms are present?
2. What do the logs/metrics tell us?
3. What is the most likely causal chain?
4. How confident are you and why?
5. What evidence is missing?

## Output Format
Respond with ONLY a JSON object matching this exact structure:
{
  "hypothesis": "string - your primary root cause hypothesis",
  "confidence": "low|medium|high",
  "evidenceFor": ["string - evidence supporting this hypothesis"],
  "evidenceGaps": ["string - known gaps in evidence"],
  "reasoning": "string - your step-by-step reasoning chain",
  "alternativeCauses": ["string - other possible causes considered"]
}

Respond with ONLY valid JSON, no markdown fences, no extra text.`;

const ANGRY_AGENT_TEMPLATE = `You are an incident devil's advocate. Your job is to CHALLENGE the analyst's hypothesis, not confirm it. You are deliberately adversarial and skeptical.

## Incident Context
Summary: {{summary}}
{{#if logs}}
Logs:
{{logs}}
{{/if}}
{{#if metrics}}
Metrics:
{{metrics}}
{{/if}}
{{#if additionalContext}}
Additional context:
{{additionalContext}}
{{/if}}

## Analyst's Hypothesis
{{analystHypothesisJson}}

## Your Task
Tear apart the analyst's reasoning. Your goal is to:
1. Find weaknesses in their logic
2. Identify blind spots they missed
3. Propose a credible ALTERNATIVE root cause
4. List specific checks that would DISPROVE their hypothesis
5. Surface unstated assumptions

Be aggressive but constructive. Do not agree with the analyst just because their hypothesis seems reasonable. Your value is in finding what they missed.

## Output Format
Respond with ONLY a JSON object matching this exact structure:
{
  "counterHypothesis": "string - your alternative root cause",
  "weaknesses": ["string - weakness in analyst's reasoning"],
  "blindSpots": ["string - things they did not consider"],
  "disconfirmingChecks": [
    {"check": "string - specific thing to check", "whatItWouldProve": "string - what finding X would mean"}
  ],
  "assumptions": ["string - unstated assumption in analyst's reasoning"],
  "alternativeExplanation": "string - detailed reasoning for your counter-hypothesis"
}

Respond with ONLY valid JSON, no markdown fences, no extra text.`;

const SYNTHESIZER_TEMPLATE = `You are an incident synthesis engine. You have two competing analyses of the same incident. Your job is to produce a balanced, actionable assessment.

## Incident Summary
{{summary}}

## Analyst's Hypothesis
{{analystHypothesisJson}}

## Devil's Advocate Counter-Hypothesis
{{counterHypothesisJson}}

## Your Task
1. Compare both hypotheses objectively
2. Rank them by confidence given ALL evidence
3. Identify critical missing evidence
4. Recommend the SAFEST next actions

SAFETY PRINCIPLES for next actions:
- Prefer rollback over forward-fix
- Prefer feature flags over code changes
- Prefer adding observability over taking action
- Prefer reversible actions over irreversible ones
- If uncertain, recommend gathering more evidence before acting

## Output Format
Respond with ONLY a JSON object matching this exact structure:
{
  "rankedHypotheses": [
    {"hypothesis": "string", "confidence": "low|medium|high", "supportedBy": "analyst|angryAgent|both"}
  ],
  "missingEvidence": [
    {"what": "string - what is missing", "how": "string - how to get it", "priority": "critical|important|nice-to-have"}
  ],
  "safestNextActions": [
    {"action": "string - specific action", "risk": "low|medium|high", "rationale": "string - why this is safe"}
  ],
  "incidentBrief": "string - 3-5 sentence operator-ready summary",
  "consensusLevel": "strong-agreement|partial-agreement|strong-disagreement"
}

Respond with ONLY valid JSON, no markdown fences, no extra text.`;

// --- Prompt Builders ---

function buildAnalystPrompt(input) {
  return renderPrompt(ANALYST_TEMPLATE, {
    summary: input.summary,
    logs: input.logs,
    metrics: input.metrics,
    postmortemDraft: input.postmortemDraft,
    additionalContext: input.additionalContext,
  });
}

function buildAngryAgentPrompt(input, analystHypothesisJson) {
  return renderPrompt(ANGRY_AGENT_TEMPLATE, {
    summary: input.summary,
    logs: input.logs,
    metrics: input.metrics,
    additionalContext: input.additionalContext,
    analystHypothesisJson,
  });
}

function buildSynthesizerPrompt(summary, analystHypothesisJson, counterHypothesisJson) {
  return renderPrompt(SYNTHESIZER_TEMPLATE, {
    summary,
    analystHypothesisJson,
    counterHypothesisJson,
  });
}

module.exports = {
  renderPrompt,
  buildAnalystPrompt,
  buildAngryAgentPrompt,
  buildSynthesizerPrompt,
  ANALYST_TEMPLATE,
  ANGRY_AGENT_TEMPLATE,
  SYNTHESIZER_TEMPLATE,
};
