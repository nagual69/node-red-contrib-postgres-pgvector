# Enterprise Features Guide

This guide covers the enterprise-grade features of @nagual69/node-red-pgvector designed for production deployments at scale.

## Table of Contents

- [Overview](#overview)
- [Observability](#observability)
  - [OpenTelemetry Integration](#opentelemetry-integration)
  - [Structured Logging](#structured-logging)
  - [Metrics & Monitoring](#metrics--monitoring)
- [Resilience & Reliability](#resilience--reliability)
- [Configuration & Validation](#configuration--validation)
- [Security](#security)
- [Production Deployment](#production-deployment)

---

## Overview

### Enterprise Features

✅ **OpenTelemetry (OTEL)** - Distributed tracing, metrics, and observability
✅ **Structured Logging** - JSON logs with pino for machine parsing
✅ **Automatic Retries** - Exponential backoff for transient failures
✅ **Query Timeouts** - Prevent hanging queries in production
✅ **Connection Health** - Pool monitoring and error handling
✅ **Comprehensive Validation** - Pre-flight checks before operations
✅ **Enhanced Error Messages** - Actionable errors with remediation steps
✅ **Performance Metrics** - Query duration tracking and analysis

### When to Use These Features

| Feature | Development | Staging | Production |
|---------|------------|---------|------------|
| OpenTelemetry | Optional | Recommended | **Required** |
| Structured Logging | Optional | Recommended | **Required** |
| Query Timeouts | Optional | Recommended | **Required** |
| Retries | Optional | Recommended | **Required** |

---

## Observability

### OpenTelemetry Integration

OpenTelemetry provides enterprise-grade observability with distributed tracing, metrics, and logs.

#### Quick Start

**1. Install optional OTEL dependencies:**
```bash
npm install @opentelemetry/api @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/exporter-metrics-otlp-http
```

**2. Configure environment variables:**
```bash
# Enable OpenTelemetry
export OTEL_ENABLED=true

# Service identification
export OTEL_SERVICE_NAME=node-red-production

# OTLP endpoint (Jaeger, Zipkin, Grafana, etc.)
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

**3. Start Node-RED:**
```bash
node-red
```

You'll see:
```
[OpenTelemetry] Initialized for node-red-production, endpoint: http://localhost:4318
```

#### What Gets Traced

**Automatic Instrumentation (pg driver):**
- Database connections
- SQL query execution
- Transaction management

**Custom Spans (pgvector nodes):**
- `pgvector-search` - Similarity search operations
- Query preparation and validation
- Vector parsing and normalization
- Result processing

**Span Attributes:**
- `msg.id` - Node-RED message ID for request tracing
- `node.id` - Node-RED node ID
- `node.name` - Node name from flow
- `table`, `column`, `metric` - Query parameters
- `error.code`, `error.message` - Error details

#### Example: Grafana Tempo + Jaeger

```yaml
# docker-compose.yml
version: '3.8'
services:
  tempo:
    image: grafana/tempo:latest
    ports:
      - "4318:4318"  # OTLP HTTP
      - "3200:3200"  # Tempo API
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
    command: ["-config.file=/etc/tempo.yaml"]

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
    volumes:
      - ./grafana-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml
```

#### Distributed Tracing Example

When a request flows through multiple Node-RED flows and external services:

```
HTTP Request → pgvector-search → PostgreSQL → pgvector-insert → External API
      ↓              ↓                 ↓               ↓              ↓
   [Span 1]      [Span 2]         [Span 3]       [Span 4]      [Span 5]
```

All spans share the same `trace_id`, allowing you to see the complete request path.

---

### Structured Logging

JSON-formatted logs using pino for machine-readable, queryable logging.

#### Configuration

```bash
# Log level: trace, debug, info, warn, error, fatal
export NODE_RED_PGVECTOR_LOG_LEVEL=info

# Environment (affects format)
export NODE_ENV=production  # JSON logs
export NODE_ENV=development # Pretty-printed logs
```

#### Log Output Examples

**Production (JSON):**
```json
{
  "level": 30,
  "time": 1706817234567,
  "name": "@nagual69/node-red-pgvector:pgvector-search",
  "msgId": "7c4f9e2d.8b3061",
  "query": "SELECT *, embedding <=> $1 AS similarity FROM documents WHERE...",
  "durationMs": 45,
  "rowCount": 10,
  "performance": "fast",
  "msg": "Query executed"
}
```

**Development (Pretty):**
```
[10:15:34.567] INFO (@nagual69/node-red-pgvector:pgvector-search/7c4f9e2d.8b3061): Query executed
    query: "SELECT *, embedding <=> $1 AS..."
    durationMs: 45
    rowCount: 10
    performance: "fast"
```

#### Log Aggregation

**ELK Stack (Elasticsearch, Logstash, Kibana):**
```bash
# Ship logs to Logstash
node-red | logstash -f logstash.conf
```

**Grafana Loki:**
```bash
# Use promtail to ship logs
node-red | promtail --config.file=promtail.yaml
```

**Splunk:**
```bash
# Use Splunk Universal Forwarder
node-red >> /var/log/node-red/pgvector.log
```

#### Query Examples

**Find slow queries:**
```js
// Elasticsearch query
{
  "query": {
    "bool": {
      "must": [
        { "term": { "name": "@nagual69/node-red-pgvector:pgvector-search" } },
        { "range": { "durationMs": { "gte": 1000 } } }
      ]
    }
  }
}
```

**Find errors by operation:**
```js
{
  "query": {
    "bool": {
      "must": [
        { "term": { "level": 50 } },  // ERROR
        { "term": { "operation": "search-query" } }
      ]
    }
  }
}
```

---

### Metrics & Monitoring

Prometheus-compatible metrics for monitoring and alerting.

#### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `pgvector.queries` | Counter | Total queries executed |
| `pgvector.query.duration` | Histogram | Query execution duration (ms) |
| `pgvector.errors` | Counter | Total errors by type |
| `pgvector.pool.total` | Gauge | Total connections in pool |
| `pgvector.pool.idle` | Gauge | Idle connections available |
| `pgvector.pool.waiting` | Gauge | Requests waiting for connection |

#### Labels/Attributes

- `operation`: search, insert, upsert, query, admin, schema
- `success`: true/false
- `table`: table name
- `error_type`: Error code (42P01, ECONNREFUSED, etc.)

#### Prometheus Setup

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'node-red-pgvector'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:4318']
    metrics_path: '/v1/metrics'
```

#### Grafana Dashboards

**Import dashboard JSON** (see `examples/grafana-dashboard.json`)

**Key Panels:**
- Query Rate (queries/sec)
- Query Duration (p50, p95, p99)
- Error Rate by Type
- Connection Pool Utilization
- Slow Query List (>1s)

#### Alerting Rules

**High Error Rate:**
```yaml
# Alert if error rate > 5% for 5 minutes
- alert: HighPgvectorErrorRate
  expr: |
    rate(pgvector_errors_total[5m]) /
    rate(pgvector_queries_total[5m]) > 0.05
  for: 5m
  annotations:
    summary: "High error rate in pgvector operations"
```

**Slow Queries:**
```yaml
- alert: SlowPgvectorQueries
  expr: |
    histogram_quantile(0.95,
      rate(pgvector_query_duration_bucket[5m])) > 1000
  for: 5m
  annotations:
    summary: "95th percentile query duration > 1s"
```

**Pool Saturation:**
```yaml
- alert: PgvectorPoolSaturated
  expr: pgvector_pool_idle == 0
  for: 2m
  annotations:
    summary: "Connection pool has no idle connections"
```

---

## Resilience & Reliability

### Automatic Retry Logic

Transient failures are automatically retried with exponential backoff.

#### What Gets Retried

✅ Connection refused (`ECONNREFUSED`)
✅ Timeout errors (`ETIMEDOUT`)
✅ "Cannot connect now" (`57P03`)
✅ "Too many connections" (`53300`)
✅ Connection terminated errors

❌ Syntax errors (permanent)
❌ Authentication errors (permanent)
❌ Permission errors (permanent)

#### Retry Configuration

**Default behavior:**
- **Max retries:** 2 (total 3 attempts)
- **Retry delay:** 500ms base, exponential backoff (500ms, 1000ms, 2000ms)
- **Timeout:** 60 seconds per attempt

**Customization:**
```javascript
// In node code or future config
{
  timeout: 30000,        // 30 second timeout
  maxRetries: 3,         // 4 total attempts
  retryDelay: 1000       // 1s, 2s, 4s, 8s backoff
}
```

#### Monitoring Retries

Retries are logged:
```json
{
  "level": 40,
  "time": 1706817234567,
  "msg": "Query failed, retrying (attempt 1/2)",
  "error": "Connection refused",
  "nextRetryMs": 1000
}
```

### Query Timeouts

Prevent hanging queries that can exhaust connection pools.

**Default timeout:** 60 seconds
**Configured via:** Node config or `msg.timeout`

**Timeout exceeded:**
```
Error: Query timeout after 60000ms. Try increasing timeout or simplifying query.
```

### Connection Health Monitoring

**Pool error handler:**
```javascript
pool.on('error', (err) => {
  console.error('Idle connection error:', err.message);
  // Logged and reported via OTEL
});
```

**Scenarios handled:**
- Idle connection dropped by server
- Network partition during idle
- PostgreSQL server restart
- Load balancer timeout

---

## Configuration & Validation

### Pre-flight Validation

All configuration is validated before creating database connections:

#### Config Node Validation

| Field | Validation | Error Message |
|-------|-----------|---------------|
| Host | Required, non-empty string | "Host is required" |
| Port | 1-65535 | "Port must be between 1 and 65535" |
| Database | Required, non-empty string | "Database name is required" |
| User | Required, non-empty string | "Database user is required" |
| Password | Required, non-empty | "Database password is required" |
| Pool Size | 1-100 | "Pool size must be between 1 and 100" |

#### Node Validation

| Node | Required Fields | Example Error |
|------|----------------|---------------|
| search | table, column, vector | "Missing required field: table. Set in node config or pass as msg.table." |
| insert | table, column, payload | "Missing required field: column. Set in node config or pass as msg.column." |
| upsert | table, column, record, id_column | "Missing required field: vector. Pass as msg.payload.vector, msg.vector, or msg.payload." |

**Benefits:**
- Fail fast before expensive operations
- Clear, actionable error messages
- Prevents silent failures
- Easier debugging

---

## Security

### Credentials Management

**Node-RED Vault:**
- Credentials stored encrypted in Node-RED credentials file
- Never exported in flows
- Accessible only to runtime

**Environment Variables:**
```bash
# Never hardcode credentials
export PGUSER=myuser
export PGPASSWORD=mypass
```

### SQL Injection Protection

**Parameterized Queries:**
```javascript
// ✅ Safe - uses $1, $2 placeholders
client.query('SELECT * FROM users WHERE id = $1', [userId]);

// ❌ Dangerous - string interpolation
client.query(`SELECT * FROM users WHERE id = '${userId}'`);
```

**Identifier Escaping:**
```javascript
// ✅ Safe - escapes table/column names
const safeTable = escapeIdentifier(userTable);
const sql = `SELECT * FROM ${safeTable}`;

// ❌ Dangerous - no escaping
const sql = `SELECT * FROM ${userTable}`;
```

### Connection Security

**SSL/TLS:**
```javascript
{
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca-cert.pem'),
    key: fs.readFileSync('/path/to/client-key.pem'),
    cert: fs.readFileSync('/path/to/client-cert.pem'),
  }
}
```

**Minimum Permissions:**
```sql
-- Read-only user for search operations
CREATE USER readonly WITH PASSWORD 'secure_pass';
GRANT CONNECT ON DATABASE vectordb TO readonly;
GRANT USAGE ON SCHEMA public TO readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- Write user for insert/upsert
CREATE USER writeuser WITH PASSWORD 'secure_pass';
GRANT INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO writeuser;
```

---

## Production Deployment

### Architecture Recommendations

**High Availability:**
```
                    Load Balancer
                          |
        +-----------------+-----------------+
        |                 |                 |
   Node-RED 1        Node-RED 2        Node-RED 3
        |                 |                 |
        +-----------------+-----------------+
                          |
                PostgreSQL Cluster
              (Primary + Read Replicas)
```

**Connection Pooling Strategy:**
- **Development:** 5-10 connections per Node-RED instance
- **Production:** 10-20 connections per Node-RED instance
- **Rule of thumb:** `(max_connections / num_instances) * 0.8`

**Example:**
- PostgreSQL max_connections: 100
- Node-RED instances: 3
- Pool size per instance: `(100 / 3) * 0.8 = 27` → Set to 20 for safety

### Monitoring Checklist

- [ ] OpenTelemetry traces flowing to Jaeger/Tempo
- [ ] Metrics scraped by Prometheus
- [ ] Logs aggregated in ELK/Loki/Splunk
- [ ] Dashboards created in Grafana
- [ ] Alerts configured for:
  - [ ] High error rate
  - [ ] Slow queries
  - [ ] Pool saturation
  - [ ] Connection failures
- [ ] On-call rotation has access to observability tools

### Performance Tuning

**PostgreSQL:**
```sql
-- Increase shared buffers
shared_buffers = 4GB

-- Increase work mem for vector operations
work_mem = 256MB

-- Enable query plan caching
shared_preload_libraries = 'pg_stat_statements'
```

**Vector Indexing:**
```sql
-- HNSW for high-dimensional vectors (faster queries)
CREATE INDEX idx_hnsw ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- IVFFlat for very large datasets (smaller index)
CREATE INDEX idx_ivf ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Node-RED:**
```bash
# Increase Node.js memory limit
node-red --max-old-space-size=4096
```

### Troubleshooting

**Common Issues:**

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Pool exhausted | "waiting for available connection" | Increase pool size or reduce concurrency |
| Slow queries | p95 duration > 1s | Add vector indexes, optimize WHERE clauses |
| High memory | Node-RED OOM crashes | Reduce pool size, limit result sets |
| Connection refused | Intermittent failures | Check firewall, network, PostgreSQL max_connections |

**Debug Mode:**
```bash
export NODE_RED_PGVECTOR_LOG_LEVEL=debug
export NODE_ENV=development
node-red
```

---

## Next Steps

1. **Enable OpenTelemetry** - Set OTEL_ENABLED=true
2. **Configure Prometheus** - Scrape metrics endpoint
3. **Create Grafana Dashboard** - Import example dashboard
4. **Set Up Alerts** - Configure alerting rules
5. **Load Test** - Verify performance under load
6. **Review Logs** - Ensure proper log aggregation
7. **Document Runbooks** - Create incident response procedures

---

## Support

- **Issues:** https://github.com/nagual69/node-red-pgvector/issues
- **Discussions:** https://github.com/nagual69/node-red-pgvector/discussions
- **Security:** Email nagual69@gmail.com with vulnerabilities

---

**Enterprise Support Available**

For enterprise support, SLAs, custom features, or consulting services, contact: nagual69@gmail.com
