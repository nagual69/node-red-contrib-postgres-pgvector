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
  statement_timeout: 60000, // 60 second query timeout
};

/**
 * Default query timeout in milliseconds.
 * @constant {number}
 */
const DEFAULT_QUERY_TIMEOUT = 60000;

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
 * @param {number} [timeout] - Optional query timeout in milliseconds
 * @returns {Promise<T>} Result of the function execution
 * @throws {Error} Propagates any error from connection or function execution
 *
 * @example
 * const result = await withClient(pool, async (client) => {
 *   return client.query('SELECT * FROM users WHERE id = $1', [userId]);
 * }, 5000);
 */
async function withClient(pool, fn, timeout) {
  const client = await pool.connect();
  try {
    // Set statement timeout if specified
    if (timeout && timeout > 0) {
      await client.query(`SET statement_timeout = ${Math.floor(timeout)}`);
    }
    return await fn(client);
  } finally {
    client.release();
  }
}

/**
 * Executes a query with automatic retry on transient failures.
 * Implements exponential backoff for connection and timeout errors.
 *
 * @template T
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {string} sql - SQL query string
 * @param {Array} params - Query parameters
 * @param {object} [options] - Query options
 * @param {number} [options.timeout] - Query timeout in milliseconds
 * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [options.retryDelay=1000] - Initial retry delay in milliseconds
 * @returns {Promise<T>} Query result
 * @throws {Error} If all retries are exhausted
 *
 * @example
 * const result = await queryWithRetry(pool,
 *   'SELECT * FROM users WHERE id = $1',
 *   [userId],
 *   { timeout: 5000, maxRetries: 3 }
 * );
 */
async function queryWithRetry(pool, sql, params, options = {}) {
  const {
    timeout = DEFAULT_QUERY_TIMEOUT,
    maxRetries = 3,
    retryDelay = 1000,
  } = options;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withClient(
        pool,
        (client) => client.query(sql, params),
        timeout
      );
    } catch (err) {
      lastError = err;

      // Check if error is retryable (transient connection/timeout errors)
      const isRetryable =
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'ETIMEDOUT' ||
        err.code === '57P03' || // PostgreSQL: cannot connect now
        err.code === '53300' || // PostgreSQL: too many connections
        err.message?.includes('timeout') ||
        err.message?.includes('Connection terminated');

      // Don't retry on last attempt or non-retryable errors
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = retryDelay * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Tests database connection health.
 *
 * @param {Pool} pool - PostgreSQL connection pool
 * @param {number} [timeout=5000] - Connection test timeout in milliseconds
 * @returns {Promise<boolean>} True if connection is healthy
 */
async function testConnection(pool, timeout = 5000) {
  try {
    await withClient(pool, (client) => client.query('SELECT 1'), timeout);
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  createPool,
  withClient,
  queryWithRetry,
  testConnection,
  POOL_DEFAULTS,
  DEFAULT_QUERY_TIMEOUT,
};
