/**
 * @fileoverview PostgreSQL connection configuration node for pgvector.
 * Manages connection pooling and credentials for all pgvector nodes.
 * @module nodes/pgvector-config
 */

'use strict';

const { createPool } = require('../lib/client');

/**
 * Registers the pgvector-config node type with Node-RED.
 * @param {object} RED - Node-RED runtime API
 */
module.exports = function registerConfigNode(RED) {
  /**
   * Configuration node constructor.
   * Creates and manages a PostgreSQL connection pool.
   * @param {object} config - Node configuration from editor
   */
  function PgvectorConfigNode(config) {
    RED.nodes.createNode(this, config);

    // Store configuration
    this.host = config.host;
    this.port = Number(config.port) || 5432;
    this.database = config.database;
    this.user = this.credentials.user;
    this.password = this.credentials.password;
    this.ssl = config.ssl || false;

    // Create connection pool
    this.pool = createPool({
      host: this.host,
      port: this.port,
      database: this.database,
      user: this.user,
      password: this.password,
      ssl: this.ssl ? { rejectUnauthorized: false } : false,
      max: Number(config.max) || 10,
    });

    // Handle node shutdown - ensure pool is properly closed
    this.on('close', (done) => {
      if (this.pool) {
        this.pool.end()
          .then(() => done())
          .catch(() => done());
      } else {
        done();
      }
    });
  }

  // Register node type with credentials
  RED.nodes.registerType('pgvector-config', PgvectorConfigNode, {
    credentials: {
      user: { type: 'text' },
      password: { type: 'password' },
    },
  });
};
