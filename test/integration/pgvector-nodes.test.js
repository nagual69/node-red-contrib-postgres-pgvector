/**
 * Integration tests for pgvector nodes
 *
 * These tests require a running PostgreSQL instance with pgvector extension.
 * Use the Docker Compose setup in test/ directory:
 *   cd test && docker-compose up -d
 *
 * Connection details (from docker-compose):
 *   Host: localhost
 *   Port: 5432
 *   Database: vectordb
 *   User: nodered
 *   Password: nodered123
 */

const assert = require('assert');
const { Pool } = require('pg');

// Skip integration tests if no database is available
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

// Connection config for tests
const TEST_CONFIG = {
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'vectordb',
  user: process.env.PGUSER || 'nodered',
  password: process.env.PGPASSWORD || 'nodered123',
};

describe('Integration: pgvector nodes', function () {
  let pool;
  const TEST_TABLE = 'test_vectors_' + Date.now();

  before(async function () {
    if (SKIP_INTEGRATION) {
      this.skip();
      return;
    }

    try {
      pool = new Pool(TEST_CONFIG);
      // Test connection
      await pool.query('SELECT 1');
    } catch (err) {
      console.log('Skipping integration tests: PostgreSQL not available');
      console.log('Run: cd test && docker-compose up -d');
      this.skip();
    }
  });

  after(async function () {
    if (pool) {
      // Clean up test table
      try {
        await pool.query(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
      } catch (e) {
        // Ignore cleanup errors
      }
      await pool.end();
    }
  });

  describe('pgvector extension', function () {
    it('should have pgvector extension available', async function () {
      const result = await pool.query(`
        SELECT * FROM pg_extension WHERE extname = 'vector'
      `);
      assert.ok(result.rows.length > 0, 'pgvector extension not installed');
    });
  });

  describe('vector operations', function () {
    before(async function () {
      // Create test table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${TEST_TABLE} (
          id SERIAL PRIMARY KEY,
          content TEXT,
          embedding vector(3)
        )
      `);
    });

    it('should insert vectors', async function () {
      const result = await pool.query(
        `INSERT INTO ${TEST_TABLE} (content, embedding) VALUES ($1, $2) RETURNING id`,
        ['test document', '[0.1, 0.2, 0.3]']
      );
      assert.ok(result.rows[0].id);
    });

    it('should perform cosine similarity search', async function () {
      // Insert test data
      await pool.query(
        `INSERT INTO ${TEST_TABLE} (content, embedding) VALUES
          ('similar doc', '[0.1, 0.2, 0.31]'),
          ('different doc', '[0.9, 0.1, 0.1]')
        `
      );

      const result = await pool.query(`
        SELECT content, embedding <=> '[0.1, 0.2, 0.3]'::vector AS distance
        FROM ${TEST_TABLE}
        ORDER BY distance ASC
        LIMIT 2
      `);

      assert.ok(result.rows.length >= 2);
      // First result should be the most similar
      assert.ok(result.rows[0].distance < result.rows[1].distance);
    });

    it('should perform L2 distance search', async function () {
      const result = await pool.query(`
        SELECT content, embedding <-> '[0.1, 0.2, 0.3]'::vector AS distance
        FROM ${TEST_TABLE}
        ORDER BY distance ASC
        LIMIT 2
      `);

      assert.ok(result.rows.length >= 2);
    });

    it('should perform inner product search', async function () {
      const result = await pool.query(`
        SELECT content, embedding <#> '[0.1, 0.2, 0.3]'::vector AS distance
        FROM ${TEST_TABLE}
        ORDER BY distance ASC
        LIMIT 2
      `);

      assert.ok(result.rows.length >= 2);
    });
  });

  describe('index creation', function () {
    const INDEX_TABLE = 'test_index_' + Date.now();

    before(async function () {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${INDEX_TABLE} (
          id SERIAL PRIMARY KEY,
          embedding vector(3)
        )
      `);
      // Insert some data for index to work with
      for (let i = 0; i < 10; i++) {
        await pool.query(
          `INSERT INTO ${INDEX_TABLE} (embedding) VALUES ($1)`,
          [`[${Math.random()}, ${Math.random()}, ${Math.random()}]`]
        );
      }
    });

    after(async function () {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${INDEX_TABLE}`);
      } catch (e) {
        // Ignore
      }
    });

    it('should create HNSW index with cosine operator', async function () {
      const indexName = `${INDEX_TABLE}_hnsw_cosine`;
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${indexName}
        ON ${INDEX_TABLE}
        USING hnsw (embedding vector_cosine_ops)
      `);

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes WHERE indexname = $1
      `, [indexName]);

      assert.ok(result.rows.length > 0, 'HNSW index not created');
    });

    it('should create IVFFlat index with L2 operator', async function () {
      const indexName = `${INDEX_TABLE}_ivf_l2`;
      await pool.query(`
        CREATE INDEX IF NOT EXISTS ${indexName}
        ON ${INDEX_TABLE}
        USING ivfflat (embedding vector_l2_ops)
        WITH (lists = 1)
      `);

      const result = await pool.query(`
        SELECT indexname FROM pg_indexes WHERE indexname = $1
      `, [indexName]);

      assert.ok(result.rows.length > 0, 'IVFFlat index not created');
    });
  });
});
