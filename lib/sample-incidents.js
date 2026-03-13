/**
 * Sample incidents for demo mode.
 *
 * Each sample includes id, title, and IncidentInput fields.
 */

const samples = [
  {
    id: 'conn-pool-deploy',
    title: 'Connection Pool Exhaustion After Deploy',
    summary: 'API p99 latency jumped from 200ms to 5s immediately after deploying v2.14.3. Error logs show connection pool exhaustion on the primary database.',
    logs: [
      '2024-01-15T10:00:12Z ERROR [db-pool] Pool exhausted: 50/50 connections in use, 23 waiters',
      '2024-01-15T10:00:13Z ERROR [api] GET /users timeout after 5000ms',
      '2024-01-15T10:00:14Z WARN  [db-pool] Connection checkout wait time: 4823ms (threshold: 1000ms)',
      '2024-01-15T10:00:15Z ERROR [db-pool] Pool exhausted: 50/50 connections in use, 41 waiters',
      '2024-01-15T09:55:00Z INFO  [deploy] v2.14.3 deployed to production (3/3 instances)',
    ].join('\n'),
    metrics: 'p99 latency: 200ms → 5000ms over 5 minutes. DB active connections: 50 (max). Error rate: 0.1% → 34%.',
  },
  {
    id: 'memory-leak-gradual',
    title: 'Gradual Memory Leak in Worker Service',
    summary: 'Worker service RSS memory grows steadily from 512MB to 4GB over 48 hours, then OOM-kills. Started after enabling the new PDF export feature. Restart temporarily fixes it.',
    metrics: 'RSS: 512MB at boot → linear growth ~3MB/min. OOM-kill at 4GB limit. Heap snapshots show growing count of PDFDocument objects.',
    additionalContext: 'PDF export feature was enabled via feature flag on Monday. Workers process ~200 export jobs/hour. Each job should be independent.',
  },
  {
    id: 'cascading-timeout',
    title: 'Cascading Timeouts Across Microservices',
    summary: 'Payment service started returning 504s at 14:02 UTC. Within 10 minutes, order service, inventory service, and notification service all began timing out. No deploys in the last 6 hours.',
    logs: [
      '14:02:01 ERROR [payment-svc] Upstream timeout: stripe-adapter did not respond within 3000ms',
      '14:03:15 ERROR [order-svc] POST /orders failed: payment service returned 504',
      '14:05:22 WARN  [inventory-svc] Circuit breaker OPEN for order-service (5 failures in 10s)',
      '14:07:44 ERROR [notification-svc] Queue backlog growing: 12,000 pending messages',
      '14:08:01 WARN  [payment-svc] Connection pool to stripe-adapter: 100/100 in use',
    ].join('\n'),
    metrics: 'Payment 504 rate: 0% → 78%. Order success rate: 99.9% → 12%. Notification queue depth: 50 → 12,000. No CPU/memory anomalies on any service.',
    additionalContext: 'Stripe had no reported incidents on their status page at the time. Our stripe-adapter is a thin proxy we maintain in-house.',
  },
  {
    id: 'dns-config-change',
    title: 'Intermittent 502s After DNS TTL Change',
    summary: 'After reducing DNS TTL from 300s to 30s for an upcoming migration, approximately 15% of requests started returning 502 errors. The errors are not consistent — they come and go in waves.',
    logs: [
      '09:12:00 INFO  [infra] DNS TTL updated: api.example.com 300s → 30s',
      '09:14:22 ERROR [nginx] 502 Bad Gateway: upstream connect error, peer=10.0.3.41:8080',
      '09:14:23 INFO  [nginx] 200 OK: upstream peer=10.0.3.42:8080',
      '09:14:24 ERROR [nginx] 502 Bad Gateway: upstream connect error, peer=10.0.3.41:8080',
      '09:15:01 WARN  [health] Instance 10.0.3.41 health check: 2/5 passing',
    ].join('\n'),
    metrics: 'Error rate oscillates between 0% and 30% on ~30s cycles. One of three backend instances (10.0.3.41) shows intermittent health check failures.',
  },
];

function getSample(id) {
  return samples.find((s) => s.id === id);
}

function listSamples() {
  return samples.map(({ id, title }) => ({ id, title }));
}

module.exports = { samples, getSample, listSamples };
