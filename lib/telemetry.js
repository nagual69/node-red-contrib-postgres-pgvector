/**
 * @fileoverview OpenTelemetry instrumentation for pgvector nodes.
 * Provides distributed tracing, metrics, and observability.
 * @module lib/telemetry
 */

'use strict';

let tracer;
let meter;
let isEnabled = false;

// Metrics
let queryCounter;
let queryDurationHistogram;
let errorCounter;
let poolMetrics;

/**
 * Initialize OpenTelemetry instrumentation.
 * Only initializes if OTEL packages are available (optional dependencies).
 *
 * Configuration via environment variables:
 * - OTEL_ENABLED: Set to 'true' to enable (default: false)
 * - OTEL_SERVICE_NAME: Service name (default: 'node-red-pgvector')
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint (default: http://localhost:4318)
 * - OTEL_TRACES_EXPORTER: Trace exporter (default: 'otlp', options: 'otlp', 'console', 'none')
 * - OTEL_METRICS_EXPORTER: Metrics exporter (default: 'otlp', options: 'otlp', 'console', 'none')
 *
 * @returns {boolean} True if successfully initialized
 */
function initializeTelemetry() {
  // Skip if not enabled
  if (process.env.OTEL_ENABLED !== 'true') {
    return false;
  }

  try {
    const api = require('@opentelemetry/api');
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
    const { Resource } = require('@opentelemetry/resources');
    const { ATTR_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');

    const serviceName = process.env.OTEL_SERVICE_NAME || 'node-red-pgvector';
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

    // Create resource with service name
    const resource = new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
    });

    // Initialize SDK with auto-instrumentation (includes pg driver)
    const sdk = new NodeSDK({
      resource,
      traceExporter: new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
      }),
      metricReader: new (require('@opentelemetry/sdk-node').PeriodicExportingMetricReader)({
        exporter: new OTLPMetricExporter({
          url: `${endpoint}/v1/metrics`,
        }),
        exportIntervalMillis: 60000, // Export every 60 seconds
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Auto-instrument pg driver for database tracing
          '@opentelemetry/instrumentation-pg': {
            enabled: true,
          },
        }),
      ],
    });

    sdk.start();

    // Get tracer and meter
    tracer = api.trace.getTracer('@nagual69/node-red-pgvector');
    meter = api.metrics.getMeter('@nagual69/node-red-pgvector');

    // Create metrics
    queryCounter = meter.createCounter('pgvector.queries', {
      description: 'Number of queries executed',
      unit: '1',
    });

    queryDurationHistogram = meter.createHistogram('pgvector.query.duration', {
      description: 'Query execution duration',
      unit: 'ms',
    });

    errorCounter = meter.createCounter('pgvector.errors', {
      description: 'Number of errors',
      unit: '1',
    });

    poolMetrics = {
      totalConnections: meter.createObservableGauge('pgvector.pool.total', {
        description: 'Total connections in pool',
        unit: '1',
      }),
      idleConnections: meter.createObservableGauge('pgvector.pool.idle', {
        description: 'Idle connections in pool',
        unit: '1',
      }),
      waitingRequests: meter.createObservableGauge('pgvector.pool.waiting', {
        description: 'Requests waiting for connection',
        unit: '1',
      }),
    };

    isEnabled = true;

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('OpenTelemetry SDK shut down successfully'))
        .catch((error) => console.error('Error shutting down OpenTelemetry SDK', error));
    });

    console.log(`[OpenTelemetry] Initialized for ${serviceName}, endpoint: ${endpoint}`);
    return true;
  } catch (err) {
    console.warn('[OpenTelemetry] Optional dependencies not installed. Install to enable telemetry:', err.message);
    return false;
  }
}

/**
 * Start a new span for tracing an operation.
 *
 * @param {string} name - Span name
 * @param {object} [attributes] - Span attributes
 * @returns {object|null} Span object or null if telemetry disabled
 *
 * @example
 * const span = startSpan('pgvector-search', { table: 'documents' });
 * try {
 *   // ... operation
 *   endSpan(span);
 * } catch (err) {
 *   endSpan(span, err);
 * }
 */
function startSpan(name, attributes = {}) {
  if (!isEnabled || !tracer) return null;

  const span = tracer.startSpan(name, {
    attributes,
  });

  return span;
}

/**
 * End a span, optionally recording an error.
 *
 * @param {object} span - Span to end
 * @param {Error} [error] - Error to record
 */
function endSpan(span, error) {
  if (!span) return;

  if (error) {
    span.recordException(error);
    span.setStatus({
      code: 2, // ERROR
      message: error.message,
    });
  } else {
    span.setStatus({ code: 1 }); // OK
  }

  span.end();
}

/**
 * Record a query execution for metrics.
 *
 * @param {string} operation - Operation type (search, insert, upsert, etc.)
 * @param {number} durationMs - Query duration in milliseconds
 * @param {boolean} success - Whether query succeeded
 * @param {string} [table] - Table name
 */
function recordQuery(operation, durationMs, success, table) {
  if (!isEnabled) return;

  const attributes = {
    operation,
    success: success.toString(),
  };

  if (table) {
    attributes.table = table;
  }

  if (queryCounter) {
    queryCounter.add(1, attributes);
  }

  if (queryDurationHistogram) {
    queryDurationHistogram.record(durationMs, attributes);
  }
}

/**
 * Record an error for metrics.
 *
 * @param {string} operation - Operation type
 * @param {string} errorType - Error type or code
 */
function recordError(operation, errorType) {
  if (!isEnabled || !errorCounter) return;

  errorCounter.add(1, {
    operation,
    error_type: errorType,
  });
}

/**
 * Register pool metrics callback.
 * Updates gauges with current pool state.
 *
 * @param {object} pool - PostgreSQL pool instance
 */
function registerPoolMetrics(pool) {
  if (!isEnabled || !poolMetrics || !pool) return;

  // Callback for observable gauges
  const callback = (observableResult) => {
    observableResult.observe(pool.totalCount || 0);
  };

  poolMetrics.totalConnections.addCallback((observableResult) => {
    observableResult.observe(pool.totalCount || 0);
  });

  poolMetrics.idleConnections.addCallback((observableResult) => {
    observableResult.observe(pool.idleCount || 0);
  });

  poolMetrics.waitingRequests.addCallback((observableResult) => {
    observableResult.observe(pool.waitingCount || 0);
  });
}

/**
 * Execute a function within a traced span.
 *
 * @template T
 * @param {string} name - Span name
 * @param {object} attributes - Span attributes
 * @param {Function} fn - Function to execute
 * @returns {Promise<T>} Function result
 */
async function withSpan(name, attributes, fn) {
  const span = startSpan(name, attributes);
  try {
    const result = await fn();
    endSpan(span);
    return result;
  } catch (err) {
    endSpan(span, err);
    throw err;
  }
}

module.exports = {
  initializeTelemetry,
  startSpan,
  endSpan,
  withSpan,
  recordQuery,
  recordError,
  registerPoolMetrics,
  get isEnabled() {
    return isEnabled;
  },
};
