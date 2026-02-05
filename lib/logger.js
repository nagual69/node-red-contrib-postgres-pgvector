/**
 * @fileoverview Structured logging utility for pgvector nodes.
 * Provides JSON-formatted logging with consistent metadata.
 * @module lib/logger
 */

'use strict';

const pino = require('pino');

/**
 * Log level from environment or default to 'info'.
 * Set NODE_RED_PGVECTOR_LOG_LEVEL to control logging.
 * @constant {string}
 */
const LOG_LEVEL = process.env.NODE_RED_PGVECTOR_LOG_LEVEL || 'info';

/**
 * Enable pretty printing in development.
 * @constant {boolean}
 */
const PRETTY_PRINT = process.env.NODE_ENV !== 'production';

/**
 * Creates a pino logger instance with standard configuration.
 * Logs are written to stdout in JSON format (or pretty-printed in dev).
 *
 * @param {string} name - Logger name (typically node type)
 * @returns {import('pino').Logger} Configured logger instance
 */
function createLogger(name) {
  return pino({
    name: `@nagual69/node-red-pgvector:${name}`,
    level: LOG_LEVEL,
    // Pretty print in development for better readability
    transport: PRETTY_PRINT
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  });
}

/**
 * Creates a child logger with additional context.
 *
 * @param {import('pino').Logger} logger - Parent logger
 * @param {object} context - Additional context to include in all logs
 * @returns {import('pino').Logger} Child logger with context
 *
 * @example
 * const logger = createLogger('pgvector-search');
 * const queryLogger = createChildLogger(logger, { msgId: msg._msgid });
 * queryLogger.info({ table: 'docs' }, 'Executing search');
 */
function createChildLogger(logger, context) {
  return logger.child(context);
}

/**
 * Logs query execution with timing information.
 *
 * @param {import('pino').Logger} logger - Logger instance
 * @param {string} sql - SQL query (first 100 chars for security)
 * @param {number} durationMs - Query duration in milliseconds
 * @param {number} rowCount - Number of rows returned/affected
 */
function logQuery(logger, sql, durationMs, rowCount) {
  const truncatedSql = sql.length > 100 ? sql.substring(0, 100) + '...' : sql;
  logger.info(
    {
      query: truncatedSql,
      durationMs: Math.round(durationMs),
      rowCount,
      performance: durationMs > 1000 ? 'slow' : 'fast',
    },
    'Query executed'
  );
}

/**
 * Logs error with structured context.
 *
 * @param {import('pino').Logger} logger - Logger instance
 * @param {Error} err - Error object
 * @param {string} operation - Operation that failed
 * @param {object} [context] - Additional context
 */
function logError(logger, err, operation, context = {}) {
  logger.error(
    {
      err: {
        message: err.message,
        code: err.code,
        stack: err.stack,
      },
      operation,
      ...context,
    },
    `Operation failed: ${operation}`
  );
}

/**
 * Logs connection pool metrics.
 *
 * @param {import('pino').Logger} logger - Logger instance
 * @param {object} pool - PostgreSQL pool instance
 */
function logPoolMetrics(logger, pool) {
  if (pool) {
    logger.debug(
      {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
      'Connection pool metrics'
    );
  }
}

module.exports = {
  createLogger,
  createChildLogger,
  logQuery,
  logError,
  logPoolMetrics,
};
