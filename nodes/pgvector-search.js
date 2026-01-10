/**
 * @fileoverview Vector similarity search node for pgvector.
 * Performs nearest neighbor search using cosine, L2, or inner product distance.
 * @module nodes/pgvector-search
 */

'use strict';

const { withClient } = require('../lib/client');
const {
  parseVector,
  normalizeVector,
  validateDimension,
  buildSimilarityQuery,
} = require('../lib/vector-utils');

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

    node.on('input', async (msg, send, done) => {
      // Validate connection
      if (!pgConfig || !pgConfig.pool) {
        node.error('No pgvector config provided', msg);
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

      // Extract vector and filter from payload
      const payload = msg.payload || {};
      const filter = msg.filter || payload.filter;
      let vec = payload.vector || msg.vector || payload;

      // Validate required fields
      if (!table || !column || vec == null) {
        node.error('table, column, and vector are required', msg);
        done();
        return;
      }

      try {
        // Parse and validate vector
        vec = validateDimension(parseVector(vec), nodeDimension);

        // Normalize if configured
        if (nodeNormalize || msg.normalize) {
          vec = normalizeVector(vec);
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

        // Execute query
        node.status({ fill: 'blue', shape: 'dot', text: 'searching' });
        const result = await withClient(pgConfig.pool, (client) => client.query(sql, params));

        // Send results
        msg.payload = result.rows;
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

  RED.nodes.registerType('pgvector-search', PgvectorSearchNode);
};
