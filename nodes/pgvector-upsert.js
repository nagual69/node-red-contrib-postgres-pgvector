const { withClient } = require('../lib/client');
const { parseVector, validateDimension, vectorLiteral } = require('../lib/vector-utils');

module.exports = function registerUpsertNode(RED) {
  function PgvectorUpsertNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    node.pgConfig = RED.nodes.getNode(config.connection);
    node.table = config.table;
    node.column = config.column;
    node.idColumn = config.idColumn || 'id';
    node.dimension = Number(config.dimension) || undefined;

    node.on('input', async (msg, send, done) => {
      const cfg = node.pgConfig;
      if (!cfg || !cfg.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }
      const table = msg.table || node.table;
      const column = msg.column || node.column;
      const idColumn = msg.idColumn || node.idColumn;
      const record = msg.payload || msg.record;
      if (!table || !column || !record) {
        node.error('table, column, and payload are required', msg);
        done();
        return;
      }
      if (!record[idColumn]) {
        node.error(`payload must include primary key ${idColumn}`, msg);
        done();
        return;
      }
      try {
        const vec = validateDimension(parseVector(record.vector), node.dimension);
        const fields = Object.keys(record).filter((k) => k !== 'vector');
        const values = fields.map((k) => record[k]);
        const placeholders = fields.map((_, idx) => `$${idx + 2}`);
        const updates = fields.map((f, idx) => `${f} = EXCLUDED.${f}`).join(', ');
        const sql = `INSERT INTO ${table} (${fields.join(', ')}, ${column}) VALUES (${placeholders.join(', ')}, $1) ON CONFLICT (${idColumn}) DO UPDATE SET ${updates}, ${column} = EXCLUDED.${column} RETURNING *`;
        const params = [vectorLiteral(vec), ...values];
        const result = await withClient(cfg.pool, (client) => client.query(sql, params));
        msg.payload = result.rows[0];
        send(msg);
        done();
      } catch (err) {
        node.error(err, msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('pgvector-upsert', PgvectorUpsertNode);
};
