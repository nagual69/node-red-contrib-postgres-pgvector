/**
 * @fileoverview PostgreSQL connection configuration node for pgvector.
 * Manages connection pooling and credentials for all pgvector nodes.
 * @module nodes/pgvector-config
 */

'use strict';

const { createPool } = require('../lib/client');
const { initializeTelemetry, registerPoolMetrics } = require('../lib/telemetry');

// Initialize telemetry once on module load (if OTEL_ENABLED=true)
initializeTelemetry();

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
    this.port = config.port != null ? Number(config.port) : 5432;
    this.database = config.database;
    this.user = this.credentials?.user;
    this.password = this.credentials?.password;
    this.ssl = config.ssl || false;
    this.poolMax = config.max != null ? Number(config.max) : 10;

    // Validation errors array
    const errors = [];

    // Validate required configuration
    if (!this.host || typeof this.host !== 'string' || this.host.trim() === '') {
      errors.push('Host is required');
    }
    if (!this.database || typeof this.database !== 'string' || this.database.trim() === '') {
      errors.push('Database name is required');
    }
    if (this.port < 1 || this.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }
    if (this.poolMax < 1 || this.poolMax > 100) {
      errors.push('Pool size must be between 1 and 100');
    }
    if (!this.user || typeof this.user !== 'string' || this.user.trim() === '') {
      errors.push('Database user is required (configure in node settings)');
    }
    if (!this.password || typeof this.password !== 'string') {
      errors.push('Database password is required (configure in node settings)');
    }

    // Only create pool if all validation passes
    if (errors.length === 0) {
      try {
        this.pool = createPool({
          host: this.host,
          port: this.port,
          database: this.database,
          user: this.user,
          password: this.password,
          ssl: this.ssl ? { rejectUnauthorized: false } : false,
          max: this.poolMax,
        });

        // Add error handler for pool-level errors (idle connection failures)
        this.pool.on('error', (err) => {
          this.error(`Database connection pool error: ${err.message}`);
        });

        // Register pool metrics for OpenTelemetry
        registerPoolMetrics(this.pool);

        this.log(`Connection pool created: ${this.user}@${this.host}:${this.port}/${this.database} (max: ${this.poolMax})`);
      } catch (err) {
        this.error(`Failed to create connection pool: ${err.message}`);
        this.pool = null;
      }
    } else {
      // Log validation errors and set pool to null
      this.pool = null;
      const errorMsg = 'Invalid configuration: ' + errors.join('; ');
      this.error(errorMsg);
      this.warn(errorMsg);
    }

    // Handle node shutdown - ensure pool is properly closed
    this.on('close', (done) => {
      if (this.pool) {
        this.log('Closing connection pool');
        this.pool.end()
          .then(() => {
            this.log('Connection pool closed successfully');
            done();
          })
          .catch((err) => {
            this.error(`Error closing connection pool: ${err.message}`);
            done();
          });
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
