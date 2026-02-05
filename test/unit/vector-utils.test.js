const assert = require('assert');
const {
  parseVector,
  normalizeVector,
  validateDimension,
  vectorLiteral,
  buildSimilarityQuery,
  escapeIdentifier,
  escapeSelectClause,
} = require('../../lib/vector-utils');

describe('vector-utils', function () {
  describe('parseVector', function () {
    it('should return null for null input', function () {
      assert.strictEqual(parseVector(null), null);
    });

    it('should return null for undefined input', function () {
      assert.strictEqual(parseVector(undefined), null);
    });

    it('should parse array of numbers', function () {
      const result = parseVector([1, 2, 3]);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it('should convert array of strings to numbers', function () {
      const result = parseVector(['1', '2', '3']);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it('should parse JSON string array', function () {
      const result = parseVector('[1, 2, 3]');
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it('should parse comma-separated string', function () {
      const result = parseVector('1, 2, 3');
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it('should parse comma-separated string without spaces', function () {
      const result = parseVector('1,2,3');
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it('should parse base64-encoded Float32Array', function () {
      // Create a Float32Array and encode it
      const floats = new Float32Array([1.0, 2.0, 3.0]);
      const base64 = Buffer.from(floats.buffer).toString('base64');
      const result = parseVector(base64);
      assert.deepStrictEqual(result, [1, 2, 3]);
    });

    it('should throw for unsupported format', function () {
      assert.throws(() => parseVector('not-a-vector'), /Unsupported vector format/);
    });

    it('should filter out non-finite values from CSV', function () {
      const result = parseVector('1, abc, 3');
      assert.deepStrictEqual(result, [1, 3]);
    });
  });

  describe('normalizeVector', function () {
    it('should return input if not array', function () {
      assert.strictEqual(normalizeVector(null), null);
      assert.strictEqual(normalizeVector('string'), 'string');
    });

    it('should return empty array unchanged', function () {
      assert.deepStrictEqual(normalizeVector([]), []);
    });

    it('should normalize a vector to unit length', function () {
      const result = normalizeVector([3, 4]);
      assert.strictEqual(result.length, 2);
      // 3/5 = 0.6, 4/5 = 0.8
      assert.ok(Math.abs(result[0] - 0.6) < 0.0001);
      assert.ok(Math.abs(result[1] - 0.8) < 0.0001);
    });

    it('should return zero vector unchanged', function () {
      const result = normalizeVector([0, 0, 0]);
      assert.deepStrictEqual(result, [0, 0, 0]);
    });
  });

  describe('validateDimension', function () {
    it('should return vector if no expected dimension', function () {
      const vec = [1, 2, 3];
      assert.strictEqual(validateDimension(vec, undefined), vec);
      assert.strictEqual(validateDimension(vec, null), vec);
      assert.strictEqual(validateDimension(vec, 0), vec);
    });

    it('should return vector if dimension matches', function () {
      const vec = [1, 2, 3];
      assert.strictEqual(validateDimension(vec, 3), vec);
    });

    it('should throw if vector is not an array', function () {
      assert.throws(() => validateDimension('not-array', 3), /Vector is not an array/);
    });

    it('should throw if dimension does not match', function () {
      assert.throws(
        () => validateDimension([1, 2, 3], 5),
        /Vector dimension 3 does not match expected 5/
      );
    });
  });

  describe('escapeIdentifier', function () {
    it('should return simple identifier as-is', function () {
      // pg-format only quotes when necessary
      const result = escapeIdentifier('users');
      assert.strictEqual(result, 'users');
    });

    it('should escape identifier with special characters', function () {
      const result = escapeIdentifier('my-table');
      assert.strictEqual(result, '"my-table"');
    });

    it('should escape identifier with quotes', function () {
      const result = escapeIdentifier('table"name');
      assert.strictEqual(result, '"table""name"');
    });

    it('should throw for null identifier', function () {
      assert.throws(() => escapeIdentifier(null), /Invalid identifier/);
    });

    it('should throw for empty string', function () {
      assert.throws(() => escapeIdentifier(''), /Invalid identifier/);
    });

    it('should safely handle SQL injection attempts', function () {
      const malicious = 'users; DROP TABLE users; --';
      const result = escapeIdentifier(malicious);
      // Should be safely quoted due to special characters
      assert.ok(result.includes('"'));
      // The result should be quoted, making it a single identifier
      assert.strictEqual(result, '"users; DROP TABLE users; --"');
    });
  });

  describe('escapeSelectClause', function () {
    it('should return * for asterisk', function () {
      assert.strictEqual(escapeSelectClause('*'), '*');
    });

    it('should return * for empty input', function () {
      assert.strictEqual(escapeSelectClause(''), '*');
      assert.strictEqual(escapeSelectClause(null), '*');
      assert.strictEqual(escapeSelectClause(undefined), '*');
    });

    it('should pass through simple column names', function () {
      // pg-format only quotes when necessary
      const result = escapeSelectClause('name');
      assert.strictEqual(result, 'name');
    });

    it('should handle multiple columns', function () {
      const result = escapeSelectClause('id, name, email');
      assert.strictEqual(result, 'id, name, email');
    });

    it('should handle * in column list', function () {
      const result = escapeSelectClause('*, count');
      assert.strictEqual(result, '*, count');
    });

    it('should leave complex expressions unquoted', function () {
      // Hyphens in column names make it a non-simple identifier,
      // so it's treated as a potential expression and left as-is
      const result = escapeSelectClause('my-col, other_col');
      assert.strictEqual(result, 'my-col, other_col');
    });
  });

  describe('buildSimilarityQuery', function () {
    it('should build query with cosine metric', function () {
      const { sql, params } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1, 0.2, 0.3],
        metric: 'cosine',
        limit: 5,
      });
      assert.ok(sql.includes('<=>'));
      assert.ok(sql.includes('embeddings'));
      assert.ok(sql.includes('vector'));
      assert.ok(sql.includes('LIMIT 5'));
      assert.strictEqual(params.length, 1);
    });

    it('should build query with l2 metric', function () {
      const { sql } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1, 0.2, 0.3],
        metric: 'l2',
      });
      assert.ok(sql.includes('<->'));
    });

    it('should build query with inner-product metric', function () {
      const { sql } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1, 0.2, 0.3],
        metric: 'inner-product',
      });
      assert.ok(sql.includes('<#>'));
    });

    it('should build query with ip metric alias', function () {
      const { sql } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1, 0.2, 0.3],
        metric: 'ip',
      });
      assert.ok(sql.includes('<#>'));
    });

    it('should add filter conditions', function () {
      const { sql, params } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1, 0.2, 0.3],
        filter: { category: 'tech' },
      });
      assert.ok(sql.includes('WHERE'));
      assert.ok(sql.includes('category'));
      assert.ok(sql.includes('$2'));
      assert.strictEqual(params[1], 'tech');
    });

    it('should add custom WHERE clause', function () {
      const { sql } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1, 0.2, 0.3],
        whereSql: 'created_at > NOW() - INTERVAL \'1 day\'',
      });
      assert.ok(sql.includes('WHERE'));
      assert.ok(sql.includes('created_at'));
    });

    it('should escape table and column names with special characters', function () {
      const { sql } = buildSimilarityQuery({
        table: 'my-table',
        column: 'my-column',
        vector: [0.1, 0.2, 0.3],
      });
      assert.ok(sql.includes('"my-table"'));
      assert.ok(sql.includes('"my-column"'));
    });

    it('should throw if table is missing', function () {
      assert.throws(
        () => buildSimilarityQuery({ column: 'vector', vector: [0.1] }),
        /table and column are required/
      );
    });

    it('should throw if column is missing', function () {
      assert.throws(
        () => buildSimilarityQuery({ table: 'embeddings', vector: [0.1] }),
        /table and column are required/
      );
    });

    it('should cap limit at 10000', function () {
      const { sql } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1],
        limit: 99999,
      });
      assert.ok(sql.includes('LIMIT 10000'));
    });

    it('should default limit to 10', function () {
      const { sql } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1],
      });
      assert.ok(sql.includes('LIMIT 10'));
    });

    it('should handle custom select clause', function () {
      const { sql } = buildSimilarityQuery({
        table: 'embeddings',
        column: 'vector',
        vector: [0.1],
        select: 'id, title',
      });
      // Simple identifiers pass through without quotes
      assert.ok(sql.includes('id'));
      assert.ok(sql.includes('title'));
    });
  });
});
