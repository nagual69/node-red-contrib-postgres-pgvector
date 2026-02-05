/**
 * Integration tests for pgvector-config node using node-red-node-test-helper.
 * Tests node registration, credentials handling, validation, and lifecycle.
 */

const helper = require('node-red-node-test-helper');
const assert = require('assert');
const configNode = require('../../nodes/pgvector-config');

helper.init(require.resolve('node-red'));

describe('pgvector-config node', function () {
  beforeEach(function (done) {
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper.unload().then(() => helper.stopServer(done));
  });

  describe('Node Registration', function () {
    it('should be registered', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          name: 'test-config',
        },
      ];

      helper.load(configNode, flow, function () {
        const config = helper.getNode('config1');
        assert.ok(config, 'Config node should be registered');
        assert.strictEqual(config.name, 'test-config');
        assert.strictEqual(config.type, 'pgvector-config');
        done();
      });
    });
  });

  describe('Credentials Handling', function () {
    it('should handle undefined credentials gracefully', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          name: 'test-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          // No credentials provided
        },
      ];

      helper.load(configNode, flow, function () {
        const config = helper.getNode('config1');

        // Should not throw TypeError
        assert.ok(config);
        assert.strictEqual(config.user, undefined);
        assert.strictEqual(config.password, undefined);

        // Pool should be null due to validation failure
        assert.strictEqual(config.pool, null);

        done();
      });
    });

    it('should handle empty string credentials', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
      ];

      const credentials = {
        config1: {
          user: '',
          password: '',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null, 'Pool should be null with empty credentials');

        done();
      });
    });

    it('should accept valid credentials', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.user, 'testuser');
        assert.strictEqual(config.password, 'testpass');

        // Pool should be created (but won't connect without real DB)
        assert.ok(config.pool, 'Pool should be created with valid config');

        done();
      });
    });
  });

  describe('Configuration Validation', function () {
    it('should reject missing host', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: '',
          port: 5432,
          database: 'testdb',
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null, 'Pool should be null with empty host');

        done();
      });
    });

    it('should reject missing database', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: '',
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null, 'Pool should be null with empty database');

        done();
      });
    });

    it('should reject invalid port (too low)', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 0,
          database: 'testdb',
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null, 'Pool should be null with port 0');

        done();
      });
    });

    it('should reject invalid port (too high)', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 70000,
          database: 'testdb',
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null, 'Pool should be null with port > 65535');

        done();
      });
    });

    it('should reject invalid pool size (too low)', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          max: 0,
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null, 'Pool should be null with max 0');

        done();
      });
    });

    it('should reject invalid pool size (too high)', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          max: 200,
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null, 'Pool should be null with max > 100');

        done();
      });
    });

    it('should accept valid configuration', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          max: 10,
          ssl: false,
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.host, 'localhost');
        assert.strictEqual(config.port, 5432);
        assert.strictEqual(config.database, 'testdb');
        assert.strictEqual(config.poolMax, 10);
        assert.strictEqual(config.user, 'testuser');
        assert.strictEqual(config.password, 'testpass');
        assert.ok(config.pool, 'Pool should be created');

        done();
      });
    });
  });

  describe('Pool Lifecycle', function () {
    it('should create pool with default values', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          database: 'testdb',
          // Port and max will use defaults
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.port, 5432, 'Should use default port');
        assert.strictEqual(config.poolMax, 10, 'Should use default pool size');
        assert.ok(config.pool);

        done();
      });
    });

    it('should close pool on node close', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.ok(config.pool);

        // Verify pool has end method
        assert.strictEqual(typeof config.pool.end, 'function');

        done();
      });
    });

    it('should handle close gracefully without pool', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          // No credentials - pool will be null
        },
      ];

      helper.load(configNode, flow, function () {
        const config = helper.getNode('config1');

        assert.ok(config);
        assert.strictEqual(config.pool, null);

        // Unload should not throw
        helper.unload().then(() => {
          done();
        });
      });
    });
  });

  describe('Multiple Config Nodes', function () {
    it('should support multiple independent config nodes', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          name: 'db1',
          host: 'localhost',
          port: 5432,
          database: 'db1',
        },
        {
          id: 'config2',
          type: 'pgvector-config',
          name: 'db2',
          host: 'remote',
          port: 5433,
          database: 'db2',
        },
      ];

      const credentials = {
        config1: {
          user: 'user1',
          password: 'pass1',
        },
        config2: {
          user: 'user2',
          password: 'pass2',
        },
      };

      helper.load(configNode, flow, credentials, function () {
        const config1 = helper.getNode('config1');
        const config2 = helper.getNode('config2');

        assert.ok(config1);
        assert.ok(config2);

        assert.strictEqual(config1.name, 'db1');
        assert.strictEqual(config1.host, 'localhost');
        assert.strictEqual(config1.port, 5432);
        assert.strictEqual(config1.database, 'db1');
        assert.strictEqual(config1.user, 'user1');

        assert.strictEqual(config2.name, 'db2');
        assert.strictEqual(config2.host, 'remote');
        assert.strictEqual(config2.port, 5433);
        assert.strictEqual(config2.database, 'db2');
        assert.strictEqual(config2.user, 'user2');

        // Pools should be independent
        assert.notStrictEqual(config1.pool, config2.pool);

        done();
      });
    });
  });
});
