const { Pool } = require('pg');

function createPool(config) {
  const {
    host,
    port,
    database,
    user,
    password,
    ssl,
    max = 10,
    idleTimeoutMillis = 30000,
    connectionTimeoutMillis = 10000,
  } = config;
  return new Pool({ host, port, database, user, password, ssl, max, idleTimeoutMillis, connectionTimeoutMillis });
}

async function withClient(pool, fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

module.exports = { createPool, withClient };
