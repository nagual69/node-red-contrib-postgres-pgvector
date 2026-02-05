/**
 * @fileoverview Database schema inspection node for pgvector.
 * Lists tables or retrieves column information for a specific table.
 * @module nodes/pgvector-schema
 */

'use strict';

const { withClient } = require('../lib/client');

/**
 * SQL query to list all public tables.
 * @constant {string}
 */
const LIST_TABLES_SQL = `
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
`;

/**
 * SQL query to get column information for a table.
 * @constant {string}
 */
const LIST_COLUMNS_SQL = `
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = $1
`;

/**
 * Registers the pgvector-schema node type with Node-RED.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerSchemaNode(RED) {
  /**
   * Schema node constructor.
   * @param {object} config - Node configuration from editor
   */
  function PgvectorSchemaNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    // Cache configuration
    const pgConfig = RED.nodes.getNode(config.connection);
    const nodeTable = config.table;

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

      // Determine if listing tables or columns
      const table = msg.table || nodeTable;

      try {
        node.status({ fill: 'blue', shape: 'dot', text: 'querying' });

        let result;
        if (table) {
          // List columns for specific table
          result = await withClient(pgConfig.pool, (client) =>
            client.query(LIST_COLUMNS_SQL, [table])
          );
        } else {
          // List all public tables
          result = await withClient(pgConfig.pool, (client) =>
            client.query(LIST_TABLES_SQL)
          );
        }

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

  RED.nodes.registerType('pgvector-schema', PgvectorSchemaNode);
};
