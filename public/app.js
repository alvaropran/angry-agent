/* global document */
/* Angry Agent — Frontend */

(function () {
  'use strict';

  // --- DOM refs ---
  const sampleSelect = document.getElementById('sample-select');
  const loadSampleBtn = document.getElementById('load-sample');
  const form = document.getElementById('incident-form');
  const analyzeBtn = document.getElementById('analyze-btn');
  const statusEl = document.getElementById('status');
  const resultsEl = document.getElementById('results');

  // --- Init ---
  loadSamples();

  loadSampleBtn.addEventListener('click', handleLoadSample);
  form.addEventListener('submit', handleAnalyze);

  // --- Load sample list ---
  async function loadSamples() {
    try {
      const res = await fetch('/api/samples');
      const list = await res.json();
      list.forEach(function (s) {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.title;
        sampleSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('Failed to load samples:', err);
    }
  }

  // --- Load a sample into the form ---
  async function handleLoadSample() {
    const id = sampleSelect.value;
    if (!id) return;

    try {
      const res = await fetch('/api/samples/' + encodeURIComponent(id));
      if (!res.ok) return;
      const sample = await res.json();

      document.getElementById('summary').value = sample.summary || '';
      document.getElementById('logs').value = sample.logs || '';
      document.getElementById('metrics').value = sample.metrics || '';
      document.getElementById('postmortemDraft').value = sample.postmortemDraft || '';
      document.getElementById('additionalContext').value = sample.additionalContext || '';

      // Open the details panel if optional fields are populated
      if (sample.logs || sample.metrics || sample.postmortemDraft || sample.additionalContext) {
        document.querySelector('details').open = true;
      }
    } catch (err) {
      showStatus('Failed to load sample: ' + err.message, 'error');
    }
  }

  // --- Analyze ---
  async function handleAnalyze(e) {
    e.preventDefault();
    hideResults();

    var body = { summary: document.getElementById('summary').value.trim() };
    var logs = document.getElementById('logs').value.trim();
    var metrics = document.getElementById('metrics').value.trim();
    var postmortemDraft = document.getElementById('postmortemDraft').value.trim();
    var additionalContext = document.getElementById('additionalContext').value.trim();

    if (logs) body.logs = logs;
    if (metrics) body.metrics = metrics;
    if (postmortemDraft) body.postmortemDraft = postmortemDraft;
    if (additionalContext) body.additionalContext = additionalContext;

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = 'Analyzing...';
    showStatus('<span class="spinner"></span>Running Analyst, Angry Agent, and Synthesizer...', 'loading');

    try {
      var res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      var data = await res.json();

      if (res.status === 422 || res.status === 400) {
        showStatus('Validation error: ' + data.error, 'error');
        return;
      }
      if (res.status === 503) {
        showStatus(data.error, 'error');
        return;
      }
      if (res.status === 500) {
        showStatus('Server error: ' + data.error, 'error');
        return;
      }

      if (!data.ok && data.error) {
        showStatus('Partial result: ' + data.error, 'partial');
      } else {
        hideStatus();
      }

      renderResults(data);
    } catch (err) {
      showStatus('Network error: ' + err.message, 'error');
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = 'Analyze Incident';
    }
  }

  // --- Render ---
  function renderResults(data) {
    resultsEl.classList.remove('hidden');

    // Brief
    if (data.synthesis) {
      document.getElementById('brief-text').textContent = data.synthesis.incidentBrief || '';
      var badge = document.getElementById('consensus-badge');
      var level = data.synthesis.consensusLevel || '';
      badge.textContent = level.replace(/-/g, ' ');
      badge.className = 'badge ' + level;
    }

    // Analyst panel
    if (data.analyst) {
      renderConfidence('analyst-confidence', data.analyst.confidence);
      document.getElementById('analyst-hypothesis').textContent = data.analyst.hypothesis;
      renderList('analyst-evidence', 'Evidence', data.analyst.evidenceFor);
      document.getElementById('analyst-reasoning').textContent = data.analyst.reasoning || '';
    }

    // Angry Agent panel
    if (data.angryAgent) {
      document.getElementById('counter-hypothesis').textContent = data.angryAgent.counterHypothesis;
      renderList('counter-weaknesses', 'Weaknesses', data.angryAgent.weaknesses);
      renderList('counter-blindspots', 'Blind Spots', data.angryAgent.blindSpots);
      renderChecks('disconfirming-checks', data.angryAgent.disconfirmingChecks);
    }

    // Missing evidence
    if (data.synthesis) {
      renderEvidence('missing-evidence', data.synthesis.missingEvidence);
      renderActions('safe-actions', data.synthesis.safestNextActions);
    }

    // Metadata
    if (data.metadata) {
      document.getElementById('meta').textContent =
        data.metadata.totalTokens + ' tokens | ' +
        (data.metadata.durationMs / 1000).toFixed(1) + 's | ' +
        new Date(data.metadata.timestamp).toLocaleTimeString();
    }
  }

  function renderConfidence(elId, level) {
    var el = document.getElementById(elId);
    el.textContent = level;
    el.className = 'confidence-bar ' + level;
  }

  function renderList(elId, label, items) {
    var el = document.getElementById(elId);
    if (!items || items.length === 0) { el.innerHTML = ''; return; }
    var html = '<div class="label">' + esc(label) + '</div><ul>';
    items.forEach(function (item) {
      html += '<li>' + esc(item) + '</li>';
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  function renderChecks(elId, checks) {
    var el = document.getElementById(elId);
    if (!checks || checks.length === 0) { el.innerHTML = ''; return; }
    var html = '<ul>';
    checks.forEach(function (c) {
      html += '<li><strong>' + esc(c.check) + '</strong><br>' +
        '<span style="color:var(--text-muted)">' + esc(c.whatItWouldProve) + '</span></li>';
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  function renderEvidence(elId, items) {
    var el = document.getElementById(elId);
    if (!items || items.length === 0) { el.innerHTML = ''; return; }
    var html = '<ul>';
    items.forEach(function (item) {
      html += '<li><span class="priority-badge priority-' + esc(item.priority) + '">' +
        esc(item.priority) + '</span>' +
        '<strong>' + esc(item.what) + '</strong><br>' +
        '<span style="color:var(--text-muted)">' + esc(item.how) + '</span></li>';
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  function renderActions(elId, actions) {
    var el = document.getElementById(elId);
    if (!actions || actions.length === 0) { el.innerHTML = ''; return; }
    var html = '<ul>';
    actions.forEach(function (a) {
      html += '<li><span class="risk-badge risk-' + esc(a.risk) + '">' +
        esc(a.risk) + ' risk</span>' +
        '<strong>' + esc(a.action) + '</strong><br>' +
        '<span style="color:var(--text-muted)">' + esc(a.rationale) + '</span></li>';
    });
    html += '</ul>';
    el.innerHTML = html;
  }

  // --- Helpers ---
  function showStatus(msg, type) {
    statusEl.innerHTML = msg;
    statusEl.className = 'status ' + type;
  }

  function hideStatus() {
    statusEl.className = 'status hidden';
    statusEl.innerHTML = '';
  }

  function hideResults() {
    resultsEl.classList.add('hidden');
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }
})();
