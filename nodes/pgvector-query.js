const { withClient } = require('../lib/client');

module.exports = function registerQueryNode(RED) {
  function PgvectorQueryNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.pgConfig = RED.nodes.getNode(config.connection);
    node.sql = config.sql;

    node.on('input', async (msg, send, done) => {
      const cfg = node.pgConfig;
      if (!cfg || !cfg.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }
      const sql = msg.sql || msg.topic || node.sql;
      const params = msg.params || msg.payload?.params || [];
      if (!sql) {
        node.error('SQL is required', msg);
        done();
        return;
      }
      node.status({ fill: 'blue', shape: 'dot', text: 'querying' });
      try {
        const result = await withClient(cfg.pool, (client) => client.query(sql, params));
        msg.payload = result.rows;
        msg.count = result.rowCount;
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

  RED.nodes.registerType('pgvector-query', PgvectorQueryNode);
};
