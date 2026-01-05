const { withClient } = require('../lib/client');
const { validateDimension } = require('../lib/vector-utils');

// Map metric names to pgvector operator classes
const metricToOpClass = {
  cosine: 'vector_cosine_ops',
  l2: 'vector_l2_ops',
  'inner-product': 'vector_ip_ops',
  ip: 'vector_ip_ops',
};

module.exports = function registerAdminNode(RED) {
  function PgvectorAdminNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.pgConfig = RED.nodes.getNode(config.connection);
    const nodeAction = config.action;
    const nodeTable = config.table;
    const nodeColumn = config.column;
    const nodeMetric = config.metric || 'cosine';
    const nodeDimension = Number(config.dimension) || undefined;
    const nodeIndexName = config.indexName || '';
    const nodeProbes = Number(config.probes) || 10;

    node.on('input', async (msg, send, done) => {
      const cfg = node.pgConfig;
      if (!cfg || !cfg.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }
      const action = msg.action || nodeAction;
      const table = msg.table || nodeTable;
      const column = msg.column || nodeColumn;
      const metric = msg.metric || nodeMetric;
      const indexName = msg.indexName || nodeIndexName || `${table}_${column}_vec_idx`;
      const dimension = msg.dimension || nodeDimension;
      const probes = msg.probes || nodeProbes;

      try {
        let result;
        switch (action) {
          case 'create-extension':
            result = await withClient(cfg.pool, (client) => client.query('CREATE EXTENSION IF NOT EXISTS vector'));
            break;
          case 'create-table': {
            const dims = Number(dimension);
            if (!dims) throw new Error('dimension is required for create-table');
            validateDimension(new Array(dims).fill(0), dims);
            const sql = `CREATE TABLE IF NOT EXISTS ${table} (id SERIAL PRIMARY KEY, metadata jsonb, ${column} vector(${dims}))`;
            result = await withClient(cfg.pool, (client) => client.query(sql));
            break;
          }
          case 'create-ivfflat': {
            const opClass = metricToOpClass[metric] || 'vector_cosine_ops';
            const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} USING ivfflat (${column} ${opClass})`;
            result = await withClient(cfg.pool, (client) => client.query(sql));
            break;
          }
          case 'create-hnsw': {
            const opClass = metricToOpClass[metric] || 'vector_cosine_ops';
            const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} USING hnsw (${column} ${opClass})`;
            result = await withClient(cfg.pool, (client) => client.query(sql));
            break;
          }
          case 'set-probes': {
            const sql = `SET ivfflat.probes = ${Number(probes) || 10}`;
            result = await withClient(cfg.pool, (client) => client.query(sql));
            break;
          }
          case 'drop-index': {
            const sql = `DROP INDEX IF EXISTS ${indexName}`;
            result = await withClient(cfg.pool, (client) => client.query(sql));
            break;
          }
          default:
            throw new Error(`Unsupported action ${action}`);
        }
        msg.payload = result?.rows || { ok: true };
        send(msg);
        done();
      } catch (err) {
        node.error(err, msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('pgvector-admin', PgvectorAdminNode);
};
