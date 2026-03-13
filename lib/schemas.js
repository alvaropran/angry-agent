/**
 * JSON schemas and Ajv validators for Angry Agent data contracts.
 *
 * Run tests: node apps/angry-agent/tests/schemas.test.js
 */

const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true });

// --- Schema Definitions ---

const incidentInputSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'IncidentInput',
  type: 'object',
  required: ['summary'],
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
      minLength: 10,
      maxLength: 5000,
    },
    logs: {
      type: 'string',
      maxLength: 20000,
    },
    metrics: {
      type: 'string',
      maxLength: 10000,
    },
    postmortemDraft: {
      type: 'string',
      maxLength: 10000,
    },
    additionalContext: {
      type: 'string',
      maxLength: 5000,
    },
  },
};

const analystHypothesisSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'AnalystHypothesis',
  type: 'object',
  required: ['hypothesis', 'confidence', 'evidenceFor', 'reasoning'],
  additionalProperties: false,
  properties: {
    hypothesis: { type: 'string' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    evidenceFor: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    evidenceGaps: {
      type: 'array',
      items: { type: 'string' },
    },
    reasoning: { type: 'string' },
    alternativeCauses: {
      type: 'array',
      items: { type: 'string' },
    },
  },
};

const counterHypothesisSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'CounterHypothesis',
  type: 'object',
  required: ['counterHypothesis', 'weaknesses', 'blindSpots', 'disconfirmingChecks'],
  additionalProperties: false,
  properties: {
    counterHypothesis: { type: 'string' },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    blindSpots: {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
    },
    disconfirmingChecks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['check', 'whatItWouldProve'],
        additionalProperties: false,
        properties: {
          check: { type: 'string' },
          whatItWouldProve: { type: 'string' },
        },
      },
      minItems: 1,
    },
    assumptions: {
      type: 'array',
      items: { type: 'string' },
    },
    alternativeExplanation: { type: 'string' },
  },
};

const synthesizedBriefSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'SynthesizedBrief',
  type: 'object',
  required: ['rankedHypotheses', 'missingEvidence', 'safestNextActions', 'incidentBrief'],
  additionalProperties: false,
  properties: {
    rankedHypotheses: {
      type: 'array',
      items: {
        type: 'object',
        required: ['hypothesis', 'confidence', 'supportedBy'],
        additionalProperties: false,
        properties: {
          hypothesis: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          supportedBy: { type: 'string', enum: ['analyst', 'angryAgent', 'both'] },
        },
      },
      minItems: 1,
    },
    missingEvidence: {
      type: 'array',
      items: {
        type: 'object',
        required: ['what', 'how', 'priority'],
        additionalProperties: false,
        properties: {
          what: { type: 'string' },
          how: { type: 'string' },
          priority: { type: 'string', enum: ['critical', 'important', 'nice-to-have'] },
        },
      },
    },
    safestNextActions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['action', 'risk', 'rationale'],
        additionalProperties: false,
        properties: {
          action: { type: 'string' },
          risk: { type: 'string', enum: ['low', 'medium', 'high'] },
          rationale: { type: 'string' },
        },
      },
      minItems: 1,
    },
    incidentBrief: { type: 'string' },
    consensusLevel: {
      type: 'string',
      enum: ['strong-agreement', 'partial-agreement', 'strong-disagreement'],
    },
  },
};

// --- Compiled Validators ---

const _validateIncidentInput = ajv.compile(incidentInputSchema);
const _validateAnalystHypothesis = ajv.compile(analystHypothesisSchema);
const _validateCounterHypothesis = ajv.compile(counterHypothesisSchema);
const _validateSynthesizedBrief = ajv.compile(synthesizedBriefSchema);

function toResult(validateFn, data) {
  const valid = validateFn(data);
  return {
    valid,
    errors: valid ? null : [...validateFn.errors],
  };
}

function validateIncidentInput(data) {
  return toResult(_validateIncidentInput, data);
}

function validateAnalystHypothesis(data) {
  return toResult(_validateAnalystHypothesis, data);
}

function validateCounterHypothesis(data) {
  return toResult(_validateCounterHypothesis, data);
}

function validateSynthesizedBrief(data) {
  return toResult(_validateSynthesizedBrief, data);
}

module.exports = {
  incidentInputSchema,
  analystHypothesisSchema,
  counterHypothesisSchema,
  synthesizedBriefSchema,
  validateIncidentInput,
  validateAnalystHypothesis,
  validateCounterHypothesis,
  validateSynthesizedBrief,
};
