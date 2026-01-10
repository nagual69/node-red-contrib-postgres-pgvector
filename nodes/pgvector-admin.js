/**
 * @fileoverview Administrative node for pgvector setup and management.
 * Handles extension installation, table creation, and index management.
 * @module nodes/pgvector-admin
 */

'use strict';

const { withClient } = require('../lib/client');
const { validateDimension, escapeIdentifier } = require('../lib/vector-utils');

/**
 * Mapping of distance metric names to pgvector operator classes.
 * @constant {Object<string, string>}
 */
const METRIC_TO_OPCLASS = Object.freeze({
  cosine: 'vector_cosine_ops',
  l2: 'vector_l2_ops',
  'inner-product': 'vector_ip_ops',
  ip: 'vector_ip_ops',
});

/**
 * Default operator class for index creation.
 * @constant {string}
 */
const DEFAULT_OPCLASS = 'vector_cosine_ops';

/**
 * Probes range limits for IVFFlat index.
 * @constant {object}
 */
const PROBES_LIMITS = Object.freeze({
  min: 1,
  max: 100,
  default: 10,
});

/**
 * Registers the pgvector-admin node type with Node-RED.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerAdminNode(RED) {
  /**
   * Admin node constructor.
   * @param {object} config - Node configuration from editor
   */
  function PgvectorAdminNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    // Cache configuration
    const pgConfig = RED.nodes.getNode(config.connection);
    const nodeAction = config.action;
    const nodeTable = config.table;
    const nodeColumn = config.column;
    const nodeMetric = config.metric || 'cosine';
    const nodeDimension = Number(config.dimension) || undefined;
    const nodeIndexName = config.indexName || '';
    const nodeProbes = Number(config.probes) || PROBES_LIMITS.default;

    node.on('input', async (msg, send, done) => {
      // Validate connection
      if (!pgConfig || !pgConfig.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }

      // Merge configuration with message properties
      const action = msg.action || nodeAction;
      const table = msg.table || nodeTable;
      const column = msg.column || nodeColumn;
      const metric = msg.metric || nodeMetric;
      const dimension = msg.dimension || nodeDimension;
      const probes = msg.probes || nodeProbes;

      // Generate default index name if not provided
      const indexName = msg.indexName || nodeIndexName || `${table}_${column}_vec_idx`;

      try {
        node.status({ fill: 'blue', shape: 'dot', text: action });

        // Pre-escape identifiers for SQL injection protection
        const safeTable = table ? escapeIdentifier(table) : null;
        const safeColumn = column ? escapeIdentifier(column) : null;
        const safeIndexName = indexName ? escapeIdentifier(indexName) : null;

        let result;

        switch (action) {
          case 'create-extension':
            result = await withClient(pgConfig.pool, (client) =>
              client.query('CREATE EXTENSION IF NOT EXISTS vector')
            );
            break;

          case 'create-table': {
            if (!safeTable || !safeColumn) {
              throw new Error('table and column are required for create-table');
            }
            const dims = Number(dimension);
            if (!dims || dims < 1) {
              throw new Error('dimension is required for create-table');
            }
            // Validate dimension is reasonable
            validateDimension(new Array(dims).fill(0), dims);

            const sql = `CREATE TABLE IF NOT EXISTS ${safeTable} (` +
              `id SERIAL PRIMARY KEY, ` +
              `metadata jsonb, ` +
              `${safeColumn} vector(${dims})` +
              `)`;
            result = await withClient(pgConfig.pool, (client) => client.query(sql));
            break;
          }

          case 'create-ivfflat': {
            if (!safeTable || !safeColumn || !safeIndexName) {
              throw new Error('table, column, and indexName are required for create-ivfflat');
            }
            const opClass = METRIC_TO_OPCLASS[metric] || DEFAULT_OPCLASS;
            const sql = `CREATE INDEX IF NOT EXISTS ${safeIndexName} ` +
              `ON ${safeTable} USING ivfflat (${safeColumn} ${opClass})`;
            result = await withClient(pgConfig.pool, (client) => client.query(sql));
            break;
          }

          case 'create-hnsw': {
            if (!safeTable || !safeColumn || !safeIndexName) {
              throw new Error('table, column, and indexName are required for create-hnsw');
            }
            const opClass = METRIC_TO_OPCLASS[metric] || DEFAULT_OPCLASS;
            const sql = `CREATE INDEX IF NOT EXISTS ${safeIndexName} ` +
              `ON ${safeTable} USING hnsw (${safeColumn} ${opClass})`;
            result = await withClient(pgConfig.pool, (client) => client.query(sql));
            break;
          }

          case 'set-probes': {
            // Sanitize probes value within allowed range
            const safeProbes = Math.max(
              PROBES_LIMITS.min,
              Math.min(Number(probes) || PROBES_LIMITS.default, PROBES_LIMITS.max)
            );
            const sql = `SET ivfflat.probes = ${safeProbes}`;
            result = await withClient(pgConfig.pool, (client) => client.query(sql));
            break;
          }

          case 'drop-index': {
            if (!safeIndexName) {
              throw new Error('indexName is required for drop-index');
            }
            const sql = `DROP INDEX IF EXISTS ${safeIndexName}`;
            result = await withClient(pgConfig.pool, (client) => client.query(sql));
            break;
          }

          default:
            throw new Error(`Unsupported action: ${action}`);
        }

        msg.payload = result?.rows || { ok: true };
        send(msg);
        node.status({});
        done();
      } catch (err) {
        node.status({ fill: 'red', shape: 'ring', text: 'error' });
        node.error(err, msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('pgvector-admin', PgvectorAdminNode);
};
