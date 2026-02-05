/**
 * @fileoverview Raw SQL query node for pgvector.
 * Executes arbitrary parameterized SQL queries against PostgreSQL.
 * @module nodes/pgvector-query
 */

'use strict';

const { withClient } = require('../lib/client');

/**
 * Registers the pgvector-query node type with Node-RED.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerQueryNode(RED) {
  /**
   * Query node constructor.
   * @param {object} config - Node configuration from editor
   */
  function PgvectorQueryNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    // Cache configuration
    const pgConfig = RED.nodes.getNode(config.connection);
    const nodeSql = config.sql;

    node.on('input', async (msg, send, done) => {
      // Validate connection
      if (!pgConfig || !pgConfig.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }

      // Validate credentials are configured
      if (!pgConfig.user || !pgConfig.password) {
        node.error('Database credentials not configured. Please edit the pgvector-config node and enter username/password.', msg);
        done();
        return;
      }

      // Get SQL from msg or node config (msg.sql > msg.topic > config.sql)
      const sql = msg.sql || msg.topic || nodeSql;

      // Get parameters from msg
      const params = msg.params || msg.payload?.params || [];

      // Validate SQL
      if (!sql) {
        node.error('SQL is required', msg);
        done();
        return;
      }

      try {
        node.status({ fill: 'blue', shape: 'dot', text: 'querying' });
        const result = await withClient(pgConfig.pool, (client) => client.query(sql, params));

        msg.payload = result.rows;
        msg.count = result.rowCount;
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

  RED.nodes.registerType('pgvector-query', PgvectorQueryNode);
};
