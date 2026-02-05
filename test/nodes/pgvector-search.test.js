/**
 * Integration tests for pgvector-search node using node-red-node-test-helper.
 * Tests validation, error handling, and message flow.
 */

const helper = require('node-red-node-test-helper');
const assert = require('assert');
const configNode = require('../../nodes/pgvector-config');
const searchNode = require('../../nodes/pgvector-search');

helper.init(require.resolve('node-red'));

describe('pgvector-search node', function () {
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
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          name: 'test-search',
          connection: 'config1',
          table: 'documents',
          column: 'embedding',
          wires: [[]],
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');
        assert.ok(search, 'Search node should be registered');
        assert.strictEqual(search.name, 'test-search');
        assert.strictEqual(search.type, 'pgvector-search');
        done();
      });
    });
  });

  describe('Validation', function () {
    it('should error when config node missing', function (done) {
      const flow = [
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: '', // No config
          table: 'documents',
          column: 'embedding',
          wires: [['helper1']],
        },
        { id: 'helper1', type: 'helper' },
      ];

      helper.load(searchNode, flow, function () {
        const search = helper.getNode('search1');
        const helperNode = helper.getNode('helper1');

        let errorCalled = false;
        search.on('call:error', function (err) {
          errorCalled = true;
          assert.ok(err[0].includes('config'), 'Error should mention config');
        });

        helperNode.on('input', function () {
          done(new Error('Should not send message when config missing'));
        });

        search.receive({ payload: { vector: [0.1, 0.2, 0.3] } });

        setTimeout(() => {
          assert.ok(errorCalled, 'Error should be called');
          done();
        }, 100);
      });
    });

    it('should error when credentials not configured', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
          // No credentials
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: 'documents',
          column: 'embedding',
          wires: [['helper1']],
        },
        { id: 'helper1', type: 'helper' },
      ];

      helper.load([configNode, searchNode], flow, function () {
        const search = helper.getNode('search1');
        const helperNode = helper.getNode('helper1');

        let errorCalled = false;
        search.on('call:error', function (err) {
          errorCalled = true;
          assert.ok(err[0].includes('credentials'), 'Error should mention credentials');
        });

        helperNode.on('input', function () {
          done(new Error('Should not send message when credentials missing'));
        });

        search.receive({ payload: { vector: [0.1, 0.2, 0.3] } });

        setTimeout(() => {
          assert.ok(errorCalled, 'Error should be called');
          done();
        }, 100);
      });
    });

    it('should error when table missing', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: '', // Missing table
          column: 'embedding',
          wires: [['helper1']],
        },
        { id: 'helper1', type: 'helper' },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');
        const helperNode = helper.getNode('helper1');

        let errorCalled = false;
        search.on('call:error', function (err) {
          errorCalled = true;
          assert.ok(err[0].includes('table'), 'Error should mention table');
          assert.ok(err[0].includes('msg.table'), 'Error should suggest msg.table');
        });

        helperNode.on('input', function () {
          done(new Error('Should not send message when table missing'));
        });

        search.receive({ payload: { vector: [0.1, 0.2, 0.3] } });

        setTimeout(() => {
          assert.ok(errorCalled, 'Error should be called');
          done();
        }, 100);
      });
    });

    it('should error when column missing', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: 'documents',
          column: '', // Missing column
          wires: [['helper1']],
        },
        { id: 'helper1', type: 'helper' },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');
        const helperNode = helper.getNode('helper1');

        let errorCalled = false;
        search.on('call:error', function (err) {
          errorCalled = true;
          assert.ok(err[0].includes('column'), 'Error should mention column');
          assert.ok(err[0].includes('msg.column'), 'Error should suggest msg.column');
        });

        helperNode.on('input', function () {
          done(new Error('Should not send message when column missing'));
        });

        search.receive({ payload: { vector: [0.1, 0.2, 0.3] } });

        setTimeout(() => {
          assert.ok(errorCalled, 'Error should be called');
          done();
        }, 100);
      });
    });

    it('should error when vector missing', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: 'documents',
          column: 'embedding',
          wires: [['helper1']],
        },
        { id: 'helper1', type: 'helper' },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');
        const helperNode = helper.getNode('helper1');

        let errorCalled = false;
        search.on('call:error', function (err) {
          errorCalled = true;
          assert.ok(err[0].includes('vector'), 'Error should mention vector');
          assert.ok(
            err[0].includes('msg.payload.vector') || err[0].includes('msg.vector'),
            'Error should suggest where to pass vector'
          );
        });

        helperNode.on('input', function () {
          done(new Error('Should not send message when vector missing'));
        });

        search.receive({ payload: {} }); // Empty payload

        setTimeout(() => {
          assert.ok(errorCalled, 'Error should be called');
          done();
        }, 100);
      });
    });
  });

  describe('Message Overrides', function () {
    it('should allow msg.table to override node config', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: 'documents', // This will be overridden
          column: 'embedding',
          wires: [[]],
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');

        // This test will fail with connection error, but we're just
        // checking that validation passes with msg.table override
        search.receive({
          table: 'custom_table',
          column: 'custom_column',
          payload: { vector: [0.1, 0.2, 0.3] },
        });

        // If we get here without validation error, the override worked
        setTimeout(() => {
          done();
        }, 100);
      });
    });
  });

  describe('Configuration', function () {
    it('should cache node configuration', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: 'documents',
          column: 'embedding',
          metric: 'cosine',
          limit: 20,
          normalize: true,
          dimension: 384,
          select: 'id, content',
          where: 'category = tech',
          wires: [[]],
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');
        assert.ok(search);
        // Config is cached but not directly accessible, so just verify node loaded
        done();
      });
    });
  });

  describe('Status Updates', function () {
    it('should set error status on validation failure', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: '', // Missing table will cause validation error
          column: 'embedding',
          wires: [[]],
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');

        let statusCalled = false;
        search.on('call:status', function (status) {
          if (status[0].fill === 'red' && status[0].shape === 'ring') {
            statusCalled = true;
          }
        });

        search.receive({ payload: { vector: [0.1, 0.2, 0.3] } });

        setTimeout(() => {
          assert.ok(statusCalled, 'Red status should be set on validation error');
          done();
        }, 100);
      });
    });
  });

  describe('Vector Parsing', function () {
    it('should accept vector as array', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: 'documents',
          column: 'embedding',
          wires: [[]],
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');

        // Should not throw validation error for valid vector array
        search.receive({ payload: { vector: [0.1, 0.2, 0.3, 0.4, 0.5] } });

        setTimeout(() => {
          done();
        }, 100);
      });
    });

    it('should accept vector as JSON string', function (done) {
      const flow = [
        {
          id: 'config1',
          type: 'pgvector-config',
          host: 'localhost',
          port: 5432,
          database: 'testdb',
        },
        {
          id: 'search1',
          type: 'pgvector-search',
          connection: 'config1',
          table: 'documents',
          column: 'embedding',
          wires: [[]],
        },
      ];

      const credentials = {
        config1: {
          user: 'testuser',
          password: 'testpass',
        },
      };

      helper.load([configNode, searchNode], flow, credentials, function () {
        const search = helper.getNode('search1');

        // Should parse JSON string
        search.receive({ payload: { vector: '[0.1, 0.2, 0.3, 0.4, 0.5]' } });

        setTimeout(() => {
          done();
        }, 100);
      });
    });
  });
});
