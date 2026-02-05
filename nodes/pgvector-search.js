/**
 * @fileoverview Vector similarity search node for pgvector.
 * Performs nearest neighbor search using cosine, L2, or inner product distance.
 * @module nodes/pgvector-search
 */

'use strict';

const { queryWithRetry, DEFAULT_QUERY_TIMEOUT } = require('../lib/client');
const {
  parseVector,
  normalizeVector,
  validateDimension,
  buildSimilarityQuery,
} = require('../lib/vector-utils');
const { createLogger, createChildLogger, logQuery, logError } = require('../lib/logger');
const { startSpan, endSpan, recordQuery, recordError } = require('../lib/telemetry');

/**
 * Registers the pgvector-search node type with Node-RED.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerSearchNode(RED) {
  /**
   * Search node constructor.
   * @param {object} config - Node configuration from editor
   */
  function PgvectorSearchNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;
    const logger = createLogger('pgvector-search');

    // Cache configuration for performance
    const pgConfig = RED.nodes.getNode(config.connection);
    const nodeTable = config.table;
    const nodeColumn = config.column;
    const nodeMetric = config.metric || 'cosine';
    const nodeLimit = Number(config.limit) || 10;
    const nodeNormalize = config.normalize || false;
    const nodeDimension = Number(config.dimension) || undefined;
    const nodeSelect = config.select || '*';
    const nodeWhere = config.where || '';
    const nodeTimeout = Number(config.timeout) || DEFAULT_QUERY_TIMEOUT;

    node.on('input', async (msg, send, done) => {
      const startTime = Date.now();
      const msgLogger = createChildLogger(logger, { msgId: msg._msgid });

      // Start OpenTelemetry span for distributed tracing
      const span = startSpan('pgvector-search', {
        'msg.id': msg._msgid,
        'node.id': node.id,
        'node.name': node.name || 'pgvector-search',
      });

      // Validate connection
      if (!pgConfig || !pgConfig.pool) {
        const errorMsg = 'No pgvector config node selected. Please configure the Connection property.';
        const err = new Error(errorMsg);
        node.error(errorMsg, msg);
        node.status({ fill: 'red', shape: 'ring', text: 'no config' });
        logError(msgLogger, err, 'validate-config');
        recordError('search', 'no_config');
        endSpan(span, err);
        done();
        return;
      }

      // Validate credentials are configured
      if (!pgConfig.user || !pgConfig.password) {
        const errorMsg = 'Database credentials not configured. Edit the pgvector-config node to set username and password.';
        node.error(errorMsg, msg);
        node.status({ fill: 'red', shape: 'ring', text: 'no credentials' });
        logError(msgLogger, new Error(errorMsg), 'validate-credentials');
        done();
        return;
      }

      // Merge node config with message properties (msg overrides node config)
      const table = msg.table || nodeTable;
      const column = msg.column || nodeColumn;
      const metric = msg.metric || nodeMetric;
      const limit = msg.limit || nodeLimit;
      const whereSql = msg.where || nodeWhere;
      const select = msg.select || nodeSelect;
      const timeout = msg.timeout || nodeTimeout;

      // Extract vector and filter from payload
      const payload = msg.payload || {};
      const filter = msg.filter || payload.filter;
      let vec = payload.vector || msg.vector || payload;

      // Detailed field validation with specific error messages
      if (!table) {
        const errorMsg = 'Missing required field: table. Set in node config or pass as msg.table.';
        node.error(errorMsg, msg);
        node.status({ fill: 'red', shape: 'ring', text: 'missing table' });
        logError(msgLogger, new Error(errorMsg), 'validate-table');
        done();
        return;
      }

      if (!column) {
        const errorMsg = 'Missing required field: column. Set in node config or pass as msg.column.';
        node.error(errorMsg, msg);
        node.status({ fill: 'red', shape: 'ring', text: 'missing column' });
        logError(msgLogger, new Error(errorMsg), 'validate-column');
        done();
        return;
      }

      if (vec == null) {
        const errorMsg = 'Missing required field: vector. Pass as msg.payload.vector, msg.vector, or msg.payload.';
        node.error(errorMsg, msg);
        node.status({ fill: 'red', shape: 'ring', text: 'missing vector' });
        logError(msgLogger, new Error(errorMsg), 'validate-vector');
        done();
        return;
      }

      try {
        // Parse and validate vector
        vec = validateDimension(parseVector(vec), nodeDimension);

        msgLogger.debug({
          table,
          column,
          metric,
          limit,
          vectorDim: vec.length,
          hasFilter: !!filter,
        }, 'Starting similarity search');

        // Normalize if configured
        if (nodeNormalize || msg.normalize) {
          vec = normalizeVector(vec);
          msgLogger.debug('Vector normalized');
        }

        // Build parameterized query
        const { sql, params } = buildSimilarityQuery({
          table,
          column,
          vector: vec,
          metric,
          limit,
          filter,
          whereSql,
          select,
        });

        // Execute query with timeout and retry
        node.status({ fill: 'blue', shape: 'dot', text: 'searching' });
        const queryStart = Date.now();

        const result = await queryWithRetry(pgConfig.pool, sql, params, {
          timeout,
          maxRetries: 2,
          retryDelay: 500,
        });

        const queryDuration = Date.now() - queryStart;
        logQuery(msgLogger, sql, queryDuration, result.rows.length);

        // Record metrics
        const totalDuration = Date.now() - startTime;
        recordQuery('search', totalDuration, true, table);

        // Send results
        msg.payload = result.rows;
        msg.rowCount = result.rows.length;
        msg.queryDuration = queryDuration;
        send(msg);
        node.status({});

        msgLogger.info({
          rowCount: result.rows.length,
          durationMs: totalDuration,
        }, 'Search completed successfully');

        // End span successfully
        endSpan(span);
        done();
      } catch (err) {
        const totalDuration = Date.now() - startTime;
        node.status({ fill: 'red', shape: 'ring', text: 'error' });

        // Enhanced error messages
        let errorMsg = err.message;
        if (err.code === '42P01') {
          errorMsg = `Table "${table}" does not exist. Create it first using pgvector-admin node.`;
        } else if (err.code === '42703') {
          errorMsg = `Column "${column}" does not exist in table "${table}".`;
        } else if (err.message?.includes('timeout')) {
          errorMsg = `Query timeout after ${timeout}ms. Try increasing timeout or simplifying query.`;
        } else if (err.message?.includes('dimension')) {
          errorMsg = `Vector dimension mismatch: ${err.message}`;
        }

        node.error(errorMsg, msg);
        logError(msgLogger, err, 'search-query', {
          table,
          column,
          metric,
          durationMs: totalDuration,
        });

        // Record error metrics
        const errorType = err.code || 'unknown';
        recordError('search', errorType);
        recordQuery('search', totalDuration, false, table);

        // End span with error
        endSpan(span, err);
        done(err);
      }
    });
  }

  RED.nodes.registerType('pgvector-search', PgvectorSearchNode);
};
