/**
 * @fileoverview Main entry point for @nagual69/node-red-pgvector package.
 * Registers all pgvector node types with the Node-RED runtime.
 * @module @nagual69/node-red-pgvector
 * @author Toby Schmeling <nagual69@gmail.com>
 * @license MIT
 */

'use strict';

/**
 * Registers all pgvector nodes with the Node-RED runtime.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerPgvectorNodes(RED) {
  require('./nodes/pgvector-config')(RED);
  require('./nodes/pgvector-query')(RED);
  require('./nodes/pgvector-insert')(RED);
  require('./nodes/pgvector-upsert')(RED);
  require('./nodes/pgvector-search')(RED);
  require('./nodes/pgvector-schema')(RED);
  require('./nodes/pgvector-admin')(RED);
};
