/**
 * @fileoverview Vector utility functions for parsing, validation, and SQL generation.
 * Provides secure identifier escaping and pgvector query building.
 * @module lib/vector-utils
 */

'use strict';

const { toSql } = require('pgvector');
const format = require('pg-format');

/**
 * Mapping of distance metric names to pgvector operators.
 * @constant {Object<string, string>}
 */
const METRIC_OPERATORS = Object.freeze({
  cosine: '<=>',
  l2: '<->',
  'inner-product': '<#>',
  ip: '<#>',
});

/**
 * Maximum allowed limit for query results.
 * @constant {number}
 */
const MAX_LIMIT = 10000;

/**
 * Default limit for query results.
 * @constant {number}
 */
const DEFAULT_LIMIT = 10;

/**
 * Regular expression for detecting base64-encoded strings.
 * @constant {RegExp}
 */
const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;

/**
 * Escapes a SQL identifier to prevent SQL injection.
 * Uses pg-format which only adds quotes when necessary for safety.
 *
 * @param {string} identifier - The identifier to escape (table, column, or index name)
 * @returns {string} Safely escaped identifier
 * @throws {Error} If identifier is null, undefined, or not a string
 *
 * @example
 * escapeIdentifier('users')       // 'users'
 * escapeIdentifier('my-table')    // '"my-table"'
 * escapeIdentifier('user"name')   // '"user""name"'
 */
function escapeIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid identifier: must be a non-empty string');
  }
  return format.ident(identifier);
}

/**
 * Validates and escapes a SELECT clause containing column names.
 * Handles '*' specially and escapes individual column identifiers.
 *
 * @param {string} selectClause - Comma-separated column names or '*'
 * @returns {string} Safely escaped select clause
 *
 * @example
 * escapeSelectClause('*')              // '*'
 * escapeSelectClause('id, name')       // 'id, name'
 * escapeSelectClause('my-col, other')  // '"my-col", other'
 */
function escapeSelectClause(selectClause) {
  if (!selectClause || selectClause.trim() === '*') {
    return '*';
  }

  return selectClause
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      if (trimmed === '*') {
        return '*';
      }

      // Handle "expr AS alias" while escaping the alias
      const asMatch = trimmed.match(/^(.*)\s+as\s+([\w.]+)$/i);
      if (asMatch) {
        const expr = asMatch[1].trim();
        const alias = escapeIdentifier(asMatch[2].trim());
        return `${expr} AS ${alias}`;
      }

      // Simple column or dotted path gets escaped; expressions are left untouched
      if (/^[\w.]+$/.test(trimmed)) {
        return escapeIdentifier(trimmed);
      }

      return trimmed;
    })
    .join(', ');
}

/**
 * Parses various vector input formats into a number array.
 * Supports: arrays, JSON strings, CSV strings, and base64-encoded Float32Arrays.
 *
 * @param {Array<number>|string|null} input - Vector in any supported format
 * @returns {Array<number>|null} Parsed vector as number array, or null if input is null/undefined
 * @throws {Error} If input format is not recognized
 *
 * @example
 * parseVector([1, 2, 3])           // [1, 2, 3]
 * parseVector('[1, 2, 3]')         // [1, 2, 3]
 * parseVector('1, 2, 3')           // [1, 2, 3]
 * parseVector(base64String)        // [...floats]
 */
function parseVector(input) {
  if (input == null) {
    return null;
  }

  // Fast path: already an array
  if (Array.isArray(input)) {
    return input.map(Number);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();

    // Try JSON parsing first (common case)
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(Number);
        }
      } catch {
        // Not valid JSON, continue to other formats
      }
    }

    // CSV format
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((v) => Number(v.trim()))
        .filter(Number.isFinite);
    }

    // Base64-encoded Float32Array
    if (BASE64_REGEX.test(trimmed) && trimmed.length % 4 === 0 && trimmed.length > 0) {
      const buf = Buffer.from(trimmed, 'base64');
      if (buf.byteLength % 4 === 0) {
        const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
        return Array.from(arr);
      }
    }
  }

  throw new Error('Unsupported vector format');
}

/**
 * Normalizes a vector to unit length (L2 normalization).
 * Returns the original vector if it's empty, not an array, or has zero magnitude.
 *
 * @param {Array<number>} vec - Vector to normalize
 * @returns {Array<number>} Normalized vector with unit length
 *
 * @example
 * normalizeVector([3, 4])  // [0.6, 0.8]
 * normalizeVector([0, 0])  // [0, 0]
 */
function normalizeVector(vec) {
  if (!Array.isArray(vec) || vec.length === 0) {
    return vec;
  }

  // Calculate L2 norm using optimized loop
  let sumSquares = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSquares += vec[i] * vec[i];
  }

  const norm = Math.sqrt(sumSquares);
  if (!Number.isFinite(norm) || norm === 0) {
    return vec;
  }

  // Normalize in single pass
  const result = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    result[i] = vec[i] / norm;
  }
  return result;
}

/**
 * Validates that a vector has the expected dimension.
 *
 * @param {Array<number>} vec - Vector to validate
 * @param {number} [expected] - Expected dimension (skip validation if falsy)
 * @returns {Array<number>} The input vector if valid
 * @throws {Error} If vector is not an array or dimension doesn't match
 *
 * @example
 * validateDimension([1, 2, 3], 3)  // [1, 2, 3]
 * validateDimension([1, 2], 3)    // throws Error
 */
function validateDimension(vec, expected) {
  if (!expected) {
    return vec;
  }
  if (!Array.isArray(vec)) {
    throw new Error('Vector is not an array');
  }
  if (vec.length !== expected) {
    throw new Error(`Vector dimension ${vec.length} does not match expected ${expected}`);
  }
  return vec;
}

/**
 * Converts a JavaScript array to a pgvector SQL literal.
 *
 * @param {Array<number>} vec - Vector array
 * @returns {string} pgvector SQL literal string
 */
function vectorLiteral(vec) {
  return toSql(vec);
}

/**
 * Builds a parameterized similarity search query for pgvector.
 *
 * @param {object} options - Query options
 * @param {string} options.table - Table name
 * @param {string} options.column - Vector column name
 * @param {Array<number>} options.vector - Query vector
 * @param {string} [options.metric='cosine'] - Distance metric (cosine, l2, inner-product, ip)
 * @param {number} [options.limit=10] - Maximum results (capped at 10000)
 * @param {Object<string, *>} [options.filter] - Key-value filters for WHERE clause
 * @param {string} [options.idColumn='id'] - ID column name
 * @param {string} [options.select='*'] - Columns to select
 * @param {string} [options.whereSql] - Additional raw WHERE clause
 * @returns {{sql: string, params: Array}} Query object with SQL and parameters
 * @throws {Error} If table or column is missing
 *
 * @example
 * const { sql, params } = buildSimilarityQuery({
 *   table: 'embeddings',
 *   column: 'vector',
 *   vector: [0.1, 0.2, 0.3],
 *   metric: 'cosine',
 *   limit: 5,
 *   filter: { category: 'tech' }
 * });
 */
function buildSimilarityQuery({
  table,
  column,
  vector,
  metric = 'cosine',
  limit = DEFAULT_LIMIT,
  filter,
  idColumn = 'id',
  select = '*',
  whereSql,
}) {
  if (!table || !column) {
    throw new Error('table and column are required');
  }

  // Escape identifiers
  const safeTable = escapeIdentifier(table);
  const safeColumn = escapeIdentifier(column);
  const safeSelect = escapeSelectClause(select);

  // Get operator for metric
  const op = METRIC_OPERATORS[metric] || METRIC_OPERATORS.cosine;

  // Build parameters array and WHERE clause
  const params = [vectorLiteral(vector)];
  const whereParts = [];

  // Add filter conditions with escaped identifiers
  if (filter && typeof filter === 'object') {
    const entries = Object.entries(filter);
    for (let i = 0; i < entries.length; i++) {
      const [key, val] = entries[i];
      params.push(val);
      whereParts.push(`${escapeIdentifier(key)} = $${params.length}`);
    }
  }

  // Add custom WHERE SQL
  if (whereSql) {
    whereParts.push(`(${whereSql})`);
  }

  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Sanitize limit
  const safeLimit = Math.max(1, Math.min(Number(limit) || DEFAULT_LIMIT, MAX_LIMIT));

  const sql = `SELECT ${safeSelect}, ${safeColumn} ${op} $1 AS similarity FROM ${safeTable} ${whereClause} ORDER BY similarity ASC LIMIT ${safeLimit}`;

  return { sql, params };
}

module.exports = {
  // Functions
  parseVector,
  normalizeVector,
  validateDimension,
  vectorLiteral,
  buildSimilarityQuery,
  escapeIdentifier,
  escapeSelectClause,
  // Constants
  METRIC_OPERATORS,
  MAX_LIMIT,
  DEFAULT_LIMIT,
};
