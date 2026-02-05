/**
 * @fileoverview Vector upsert node for pgvector.
 * Performs INSERT ... ON CONFLICT DO UPDATE for idempotent vector storage.
 * @module nodes/pgvector-upsert
 */

'use strict';

const { withClient } = require('../lib/client');
const {
  parseVector,
  validateDimension,
  vectorLiteral,
  escapeIdentifier,
} = require('../lib/vector-utils');

/**
 * Registers the pgvector-upsert node type with Node-RED.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerUpsertNode(RED) {
  /**
   * Upsert node constructor.
   * @param {object} config - Node configuration from editor
   */
  function PgvectorUpsertNode(config) {
    RED.nodes.createNode(this, config);

    const node = this;

    // Cache configuration
    const pgConfig = RED.nodes.getNode(config.connection);
    const nodeTable = config.table;
    const nodeColumn = config.column;
    const nodeIdColumn = config.idColumn || 'id';
    const nodeDimension = Number(config.dimension) || undefined;

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

      // Merge configuration
      const table = msg.table || nodeTable;
      const column = msg.column || nodeColumn;
      const idColumn = msg.idColumn || nodeIdColumn;
      const record = msg.payload || msg.record;

      // Validate required fields
      if (!table || !column || !record) {
        node.error('table, column, and payload are required', msg);
        done();
        return;
      }

      // Validate primary key presence
      if (!record[idColumn]) {
        node.error(`payload must include primary key "${idColumn}"`, msg);
        done();
        return;
      }

      try {
        // Escape identifiers
        const safeTable = escapeIdentifier(table);
        const safeColumn = escapeIdentifier(column);
        const safeIdColumn = escapeIdentifier(idColumn);

        // Parse and validate vector
        const vec = validateDimension(parseVector(record.vector), nodeDimension);

        // Extract and escape field names (excluding vector)
        const fields = Object.keys(record).filter((k) => k !== 'vector');
        const safeFields = fields.map(escapeIdentifier);
        const values = fields.map((k) => record[k]);

        // Build parameterized placeholders
        const placeholders = fields.map((_, idx) => `$${idx + 2}`);

        // Build UPDATE SET clause for conflict
        const updateParts = safeFields.map((f) => `${f} = EXCLUDED.${f}`);
        updateParts.push(`${safeColumn} = EXCLUDED.${safeColumn}`);

        // Construct upsert SQL
        const sql = `INSERT INTO ${safeTable} (${safeFields.join(', ')}, ${safeColumn}) ` +
          `VALUES (${placeholders.join(', ')}, $1) ` +
          `ON CONFLICT (${safeIdColumn}) DO UPDATE SET ${updateParts.join(', ')} ` +
          `RETURNING *`;

        const params = [vectorLiteral(vec), ...values];

        // Execute upsert
        node.status({ fill: 'blue', shape: 'dot', text: 'upserting' });
        const result = await withClient(pgConfig.pool, (client) => client.query(sql, params));

        msg.payload = result.rows[0];
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

  RED.nodes.registerType('pgvector-upsert', PgvectorUpsertNode);
};
