const { withClient } = require('../lib/client');
const { parseVector, normalizeVector, validateDimension, buildSimilarityQuery } = require('../lib/vector-utils');

module.exports = function registerSearchNode(RED) {
  function PgvectorSearchNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.pgConfig = RED.nodes.getNode(config.connection);
    node.table = config.table;
    node.column = config.column;
    const nodeMetric = config.metric || 'cosine';
    node.limit = Number(config.limit) || 10;
    node.normalize = config.normalize || false;
    node.dimension = Number(config.dimension) || undefined;
    node.select = config.select || '*';
    node.where = config.where || '';

    node.on('input', async (msg, send, done) => {
      const cfg = node.pgConfig;
      if (!cfg || !cfg.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }
      const table = msg.table || node.table;
      const column = msg.column || node.column;
      const metric = msg.metric || nodeMetric;
      const limit = msg.limit || node.limit;
      const whereSql = msg.where || node.where;
      const select = msg.select || node.select;
      const payload = msg.payload || {};
      const filter = msg.filter || payload.filter;
      let vec = payload.vector || msg.vector || payload;
      if (!table || !column || vec == null) {
        node.error('table, column, and vector are required', msg);
        done();
        return;
      }
      try {
        vec = validateDimension(parseVector(vec), node.dimension);
        if (node.normalize || msg.normalize) {
          vec = normalizeVector(vec);
        }
        const { sql, params } = buildSimilarityQuery({
          table,
          column,
          vector: vec,
          metric,
          limit,
          filter,
          whereSql,
          select,
        });
        node.status({ fill: 'blue', shape: 'dot', text: 'searching' });
        const result = await withClient(cfg.pool, (client) => client.query(sql, params));
        msg.payload = result.rows;
        send(msg);
        node.status({});
        done();
      } catch (err) {
        node.status({ fill: 'red', shape: 'ring', text: 'error' });
        node.error(err, msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('pgvector-search', PgvectorSearchNode);
};
