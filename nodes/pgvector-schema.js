const { withClient } = require('../lib/client');

module.exports = function registerSchemaNode(RED) {
  function PgvectorSchemaNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.pgConfig = RED.nodes.getNode(config.connection);

    node.on('input', async (msg, send, done) => {
      const cfg = node.pgConfig;
      if (!cfg || !cfg.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }
      const table = msg.table || config.table;
      try {
        const sql = table
          ? `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1`
          : `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
        const params = table ? [table] : [];
        const result = await withClient(cfg.pool, (client) => client.query(sql, params));
        msg.payload = result.rows;
        send(msg);
        done();
      } catch (err) {
        node.error(err, msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('pgvector-schema', PgvectorSchemaNode);
};
