/**
 * @fileoverview PostgreSQL connection pool management utilities.
 * Provides connection pooling and safe client acquisition/release.
 * @module lib/client
 */

'use strict';

const { Pool } = require('pg');

/**
 * Default pool configuration values.
 * @constant {object}
 */
const POOL_DEFAULTS = {
  port: 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

/**
 * Creates a PostgreSQL connection pool with the specified configuration.
 *
 * @param {object} config - Pool configuration options
 * @param {string} config.host - Database server hostname
 * @param {number} [config.port=5432] - Database server port
 * @param {string} config.database - Database name
 * @param {string} config.user - Database username
 * @param {string} config.password - Database password
 * @param {boolean|object} [config.ssl=false] - SSL configuration
 * @param {number} [config.max=10] - Maximum pool size
 * @param {number} [config.idleTimeoutMillis=30000] - Idle connection timeout
 * @param {number} [config.connectionTimeoutMillis=10000] - Connection timeout
 * @returns {Pool} Configured pg Pool instance
 *
 * @example
 * const pool = createPool({
 *   host: 'localhost',
 *   database: 'vectordb',
 *   user: 'postgres',
 *   password: 'secret'
 * });
 */
function createPool(config) {
  const {
    host,
    port = POOL_DEFAULTS.port,
    database,
    user,
    password,
    ssl = false,
    max = POOL_DEFAULTS.max,
    idleTimeoutMillis = POOL_DEFAULTS.idleTimeoutMillis,
    connectionTimeoutMillis = POOL_DEFAULTS.connectionTimeoutMillis,
  } = config;

  return new Pool({
    host,
    port,
    database,
    user,
    password,
    ssl,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
  });
}

/**
 * Executes a function with a client from the pool, ensuring proper release.
 * Uses try/finally to guarantee client release even on errors.
 *
 * @template T
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {function(import('pg').PoolClient): Promise<T>} fn - Async function to execute with client
 * @returns {Promise<T>} Result of the function execution
 * @throws {Error} Propagates any error from connection or function execution
 *
 * @example
 * const result = await withClient(pool, async (client) => {
 *   return client.query('SELECT * FROM users WHERE id = $1', [userId]);
 * });
 */
async function withClient(pool, fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

module.exports = {
  createPool,
  withClient,
  POOL_DEFAULTS,
};
