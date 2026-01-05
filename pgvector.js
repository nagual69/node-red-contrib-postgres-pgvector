module.exports = function registerPgvectorNodes(RED) {
  // Register each node type with Node-RED
  require('./nodes/pgvector-config')(RED);
  require('./nodes/pgvector-query')(RED);
  require('./nodes/pgvector-insert')(RED);
  require('./nodes/pgvector-upsert')(RED);
  require('./nodes/pgvector-search')(RED);
  require('./nodes/pgvector-schema')(RED);
  require('./nodes/pgvector-admin')(RED);
};
