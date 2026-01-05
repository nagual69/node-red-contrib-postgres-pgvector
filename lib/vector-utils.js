const { toSql } = require('pgvector');

function parseVector(input) {
  if (input == null) return null;
  if (Array.isArray(input)) return input.map(Number);
  if (typeof input === 'string') {
    const trimmed = input.trim();
    // Accept base64 or JSON or comma separated
    try {
      const maybeJson = JSON.parse(trimmed);
      if (Array.isArray(maybeJson)) return maybeJson.map(Number);
    } catch (_) {
      // not json
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((v) => Number.isFinite(v));
    }
    // Base64-encoded Float32Array
    if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length % 4 === 0) {
      const buf = Buffer.from(trimmed, 'base64');
      const arr = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
      return Array.from(arr);
    }
  }
  throw new Error('Unsupported vector format');
}

function normalizeVector(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return vec;
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (!Number.isFinite(norm) || norm === 0) return vec;
  return vec.map((v) => v / norm);
}

function validateDimension(vec, expected) {
  if (!expected) return vec;
  if (!Array.isArray(vec)) throw new Error('Vector is not an array');
  if (vec.length !== expected) {
    throw new Error(`Vector dimension ${vec.length} does not match expected ${expected}`);
  }
  return vec;
}

function vectorLiteral(vec) {
  // Convert JS array to pgvector literal
  return toSql(vec);
}

function buildSimilarityQuery({
  table,
  column,
  vector,
  metric = 'cosine',
  limit = 10,
  filter,
  idColumn = 'id',
  select = '*',
  whereSql,
}) {
  if (!table || !column) throw new Error('table and column are required');
  const opByMetric = {
    cosine: '<=>',
    l2: '<->',
    'inner-product': '<#>',
    ip: '<#>',
  };
  const op = opByMetric[metric] || '<=>';
  const whereParts = [];
  const params = [vectorLiteral(vector)];
  if (filter && typeof filter === 'object') {
    Object.entries(filter).forEach(([key, val]) => {
      params.push(val);
      whereParts.push(`${key} = $${params.length}`);
    });
  }
  if (whereSql) {
    whereParts.push(`(${whereSql})`);
  }
  const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
  const sql = `SELECT ${select}, ${column} ${op} $1 AS similarity FROM ${table} ${where} ORDER BY similarity ASC LIMIT ${Number(limit) || 10}`;
  return { sql, params };
}

module.exports = {
  parseVector,
  normalizeVector,
  validateDimension,
  vectorLiteral,
  buildSimilarityQuery,
};
