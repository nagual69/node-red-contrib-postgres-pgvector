const assert = require('assert');
const sinon = require('sinon');
const { createPool, withClient } = require('../../lib/client');

describe('client', function () {
  describe('createPool', function () {
    it('should create a pool with default options', function () {
      const pool = createPool({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
      });

      assert.ok(pool);
      assert.ok(typeof pool.connect === 'function');
      assert.ok(typeof pool.end === 'function');

      // Clean up
      pool.end();
    });

    it('should use custom pool size', function () {
      const pool = createPool({
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
        max: 5,
      });

      assert.ok(pool);
      assert.strictEqual(pool.options.max, 5);

      pool.end();
    });

    it('should use default pool size of 10', function () {
      const pool = createPool({
        host: 'localhost',
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
      });

      assert.strictEqual(pool.options.max, 10);

      pool.end();
    });

    it('should configure SSL when enabled', function () {
      const pool = createPool({
        host: 'localhost',
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
        ssl: { rejectUnauthorized: false },
      });

      assert.ok(pool.options.ssl);

      pool.end();
    });
  });

  describe('withClient', function () {
    it('should execute function with client and release', async function () {
      // Create a mock pool
      const mockClient = {
        query: sinon.stub().resolves({ rows: [{ id: 1 }] }),
        release: sinon.spy(),
      };
      const mockPool = {
        connect: sinon.stub().resolves(mockClient),
      };

      const result = await withClient(mockPool, async (client) => {
        return client.query('SELECT 1');
      });

      assert.ok(mockPool.connect.calledOnce);
      assert.ok(mockClient.query.calledOnce);
      assert.ok(mockClient.release.calledOnce);
      assert.deepStrictEqual(result, { rows: [{ id: 1 }] });
    });

    it('should release client even if function throws', async function () {
      const mockClient = {
        query: sinon.stub().rejects(new Error('Query failed')),
        release: sinon.spy(),
      };
      const mockPool = {
        connect: sinon.stub().resolves(mockClient),
      };

      await assert.rejects(
        async () => {
          await withClient(mockPool, async (client) => {
            return client.query('INVALID SQL');
          });
        },
        { message: 'Query failed' }
      );

      assert.ok(mockClient.release.calledOnce);
    });

    it('should propagate errors from pool.connect', async function () {
      const mockPool = {
        connect: sinon.stub().rejects(new Error('Connection failed')),
      };

      await assert.rejects(
        async () => {
          await withClient(mockPool, async () => {});
        },
        { message: 'Connection failed' }
      );
    });
  });
});
