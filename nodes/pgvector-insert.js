/**
 * @fileoverview Batch vector insertion node for pgvector.
 * Supports inserting single or multiple records with embeddings.
 * @module nodes/pgvector-insert
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
 * Registers the pgvector-insert node type with Node-RED.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerInsertNode(RED) {
  /**
   * Insert node constructor.
   * @param {object} config - Node configuration from editor
   */
  function PgvectorInsertNode(config) {
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

      // Merge configuration
      const table = msg.table || nodeTable;
      const column = msg.column || nodeColumn;
      const idColumn = msg.idColumn || nodeIdColumn;
      const payload = msg.payload || msg.record;

      // Validate required fields
      if (!table || !column || !payload) {
        node.error('table, column, and payload are required', msg);
        done();
        return;
      }

      // Normalize to array for batch processing
      const records = Array.isArray(payload) ? payload : [payload];

      if (records.length === 0) {
        node.error('No records to insert', msg);
        done();
        return;
      }

      try {
        // Escape identifiers for SQL injection protection
        const safeTable = escapeIdentifier(table);
        const safeColumn = escapeIdentifier(column);
        const safeIdColumn = escapeIdentifier(idColumn);

        // Extract field names from first record (excluding vector)
        const first = records[0];
        const fields = Object.keys(first).filter((k) => k !== 'vector');
        const safeFields = fields.map(escapeIdentifier);

        // Build value rows with validated vectors
        const valueRows = [];
        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          const rowVec = validateDimension(parseVector(r.vector), nodeDimension);
          const rowValues = [vectorLiteral(rowVec)];
          for (let j = 0; j < fields.length; j++) {
            rowValues.push(r[fields[j]]);
          }
          valueRows.push(rowValues);
        }

        // Build parameterized INSERT statement
        const columnsPerRow = fields.length + 1;
        const valuePlaceholders = valueRows.map((_, rowIdx) => {
          const base = rowIdx * columnsPerRow;
          const placeholders = [];
          for (let i = 0; i < columnsPerRow; i++) {
            placeholders.push(`$${base + i + 1}`);
          }
          return `(${placeholders.join(', ')})`;
        }).join(', ');

        const sql = `INSERT INTO ${safeTable} (${safeColumn}, ${safeFields.join(', ')}) VALUES ${valuePlaceholders} RETURNING ${safeIdColumn}`;
        const flatParams = valueRows.flat();

        // Execute insert
        node.status({ fill: 'blue', shape: 'dot', text: 'inserting' });
        const result = await withClient(pgConfig.pool, (client) => client.query(sql, flatParams));

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

  RED.nodes.registerType('pgvector-insert', PgvectorInsertNode);
};
