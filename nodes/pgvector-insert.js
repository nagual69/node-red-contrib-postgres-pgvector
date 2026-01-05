const { withClient } = require('../lib/client');
const { parseVector, validateDimension, vectorLiteral } = require('../lib/vector-utils');

module.exports = function registerInsertNode(RED) {
  function PgvectorInsertNode(config) {
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
      const payload = msg.payload || msg.record;
      if (!table || !column || !payload) {
        node.error('table, column, and payload are required', msg);
        done();
        return;
      }
      const records = Array.isArray(payload) ? payload : [payload];
      try {
        const first = records[0];
        const vec = validateDimension(parseVector(first.vector), node.dimension);
        const fields = Object.keys(first).filter((k) => k !== 'vector');
        const valueRows = records.map((r) => {
          const rowVec = validateDimension(parseVector(r.vector), node.dimension);
          const rowValues = fields.map((k) => r[k]);
          return [vectorLiteral(rowVec), ...rowValues];
        });
        const placeholders = fields.map((_, idx) => `$${idx + 2}`);
        const valuesSql = valueRows
          .map((_, rowIdx) => {
            const base = rowIdx * (fields.length + 1);
            const rowPlaceholders = [1 + base]
              .concat(fields.map((__, idx) => 2 + base + idx))
              .map((pos) => `$${pos}`)
              .join(', ');
            return `(${rowPlaceholders})`;
          })
          .join(', ');
        const sql = `INSERT INTO ${table} (${column}, ${fields.join(', ')}) VALUES ${valuesSql} RETURNING ${idColumn}`;
        const flatParams = valueRows.flat();
        const result = await withClient(cfg.pool, (client) => client.query(sql, flatParams));
        msg.payload = result.rows;
        send(msg);
        done();
      } catch (err) {
        node.error(err, msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('pgvector-insert', PgvectorInsertNode);
};
