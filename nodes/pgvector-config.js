const { createPool } = require('../lib/client');

module.exports = function registerConfigNode(RED) {
  function PgvectorConfigNode(config) {
    RED.nodes.createNode(this, config);
    this.host = config.host;
    this.port = Number(config.port) || 5432;
    this.database = config.database;
    this.user = this.credentials.user;
    this.password = this.credentials.password;
    this.ssl = config.ssl || false;
    this.pool = createPool({
      host: this.host,
      port: this.port,
      database: this.database,
      user: this.user,
      password: this.password,
      ssl: this.ssl ? { rejectUnauthorized: false } : false,
      max: Number(config.max) || 10,
    });

    this.on('close', (done) => {
      if (this.pool) {
        this.pool.end().then(() => done()).catch(() => done());
      } else {
        done();
      }
    });
  }

  RED.nodes.registerType('pgvector-config', PgvectorConfigNode, {
    credentials: {
      user: { type: 'text' },
      password: { type: 'password' },
    },
  });
};
