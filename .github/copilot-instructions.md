# Node-RED pgvector Package — AI Agent Guidelines

## Architecture

This is a **Node-RED contrib package** for PostgreSQL + pgvector vector similarity operations. Entry point: [pgvector.js](pgvector.js) registers 7 node types via `require()` calls to [nodes/](nodes/).

**Node types:**
- `pgvector-config` (credentials node) — manages connection pool, credentials stored in Node-RED vault
- `pgvector-query/insert/upsert/search/schema/admin` — operational nodes calling `withClient(pool, fn)`

**Library pattern:**
- [lib/client.js](lib/client.js) — `createPool()` and `withClient()` for connection lifecycle
- [lib/vector-utils.js](lib/vector-utils.js) — `parseVector()` supports arrays, JSON, CSV, base64; `buildSimilarityQuery()` generates pgvector distance operators (`<=>`, `<->`, `<#>`)

## Node Implementation Pattern

Each node follows this structure (see [nodes/pgvector-search.js](nodes/pgvector-search.js)):
```javascript
module.exports = function(RED) {
  function NodeName(config) {
    RED.nodes.createNode(this, config);
    this.pgConfig = RED.nodes.getNode(config.connection); // Get pool reference
    this.on('input', async (msg, send, done) => {
      // 1. Merge node config with msg properties (msg overrides)
      // 2. Call withClient(pool, fn) for database ops
      // 3. Set node.status() during operations
      // 4. send(msg) with results, done() on completion
      // 5. node.error(err, msg) + done(err) on errors
    });
  }
  RED.nodes.registerType('type-name', NodeName);
};
```

**HTML companion files** use `RED.nodes.registerType()` with `defaults`, `category: 'analysis'`, and data templates for UI forms.

## Vector Handling Conventions

- **Input formats:** Accept `msg.payload.vector`, `msg.vector`, or `msg.payload` (flexible)
- **Parsing:** Use `parseVector()` for arrays/JSON/CSV/base64 → always return float array
- **Normalization:** Apply `normalizeVector()` when `normalize` flag set (for cosine similarity)
- **Validation:** Use `validateDimension(vec, expected)` when dimension configured

Example from [nodes/pgvector-search.js](nodes/pgvector-search.js#L38-L42):
```javascript
vec = validateDimension(parseVector(vec), node.dimension);
if (node.normalize || msg.normalize) {
  vec = normalizeVector(vec);
}
```

## Database Operations

All queries use parameterized SQL with `$1, $2...` placeholders (never string interpolation for user data):
```javascript
const { sql, params } = buildSimilarityQuery({ table, column, vector: vec, metric, limit, filter, whereSql });
await withClient(pool, (client) => client.query(sql, params));
```

**Admin operations** ([nodes/pgvector-admin.js](nodes/pgvector-admin.js)) use switch/case for actions: `create-extension`, `create-table`, `create-ivfflat`, `create-hnsw`, `set-probes`, `drop-index`.

## Development Workflows

- **No build step** — pure Node.js, no transpilation required
- **TypeScript definitions** in [index.d.ts](index.d.ts) for editor support (not runtime)
- **Testing:** Use Docker Compose setup in [test/](test/) directory with PostgreSQL + Node-RED
- **Quick test environment:** `cd test && docker-compose up -d` → access Node-RED at http://localhost:1880
- **Manual install:** `npm install` → `npm link` → open Node-RED → import [examples/basic-flows.json](examples/basic-flows.json)
- **Requires PostgreSQL** with `vector` extension installed to test

## Critical Conventions

1. **Credentials:** Never hardcode; use Node-RED credentials API (see [nodes/pgvector-config.js](nodes/pgvector-config.js#L28-L32))
2. **Pool cleanup:** Always implement `this.on('close', ...)` to call `pool.end()` in config nodes
3. **Message passing:** Preserve `msg` properties; only modify `msg.payload` for results
4. **Status updates:** Use `node.status({fill, shape, text})` for visual feedback (blue=processing, red=error, empty=idle)
5. **Error handling:** Call `node.error(err, msg)` AND `done(err)` to properly track errors in Node-RED

## Metric/Operator Mapping

From [lib/vector-utils.js](lib/vector-utils.js#L55-L60):
- `cosine` → `<=>` operator
- `l2` → `<->` operator  
- `inner-product` or `ip` → `<#>` operator

## Dependencies

- `pg` ^8.12.0 — node-postgres driver
- `pgvector` ^0.1.8 — provides `toSql()` for vector literal conversion
- Node.js >=18 (engines requirement)

## Node-RED Publication Standards

This package is designed for publication to npm and the Node-RED Flow Library. Follow these requirements:

### Package Requirements
1. **Naming:** Use scoped names (`@scope/node-red-packagename`) per 2022 Node-RED guidelines
2. **package.json must include:**
   - `node-red.version: ">=2.0.0"` to specify minimum Node-RED version
   - `author` field with name and email
   - `node-red` keyword for discoverability (add only when stable)
   - `license` field (MIT) with corresponding LICENSE file
   - `repository`, `homepage`, and `bugs` URLs

### HTML Help Documentation
Follow the [Node-RED Help Style Guide](https://nodered.org/docs/creating-nodes/help-style-guide):
- Use `<h3>` for section headers: Inputs, Outputs, Details, Example, References
- Document message properties with `<dl class="message-properties">` structure
- Mark optional properties with `<dt class="optional">`
- Include `<span class="property-type">` for type hints
- Provide code examples in `<pre>` blocks

Example from [nodes/pgvector-search.html](nodes/pgvector-search.html#L73-L127):
```html
<h3>Inputs</h3>
<dl class="message-properties">
  <dt>payload.vector <span class="property-type">array | string</span></dt>
  <dd>Query vector as float array, JSON string, CSV, or base64-encoded Float32Array</dd>
  
  <dt class="optional">metric <span class="property-type">string</span></dt>
  <dd>Distance metric: "cosine" (default), "l2", or "inner-product"</dd>
</dl>
```

### Error Handling Requirements
- **Always call both** `node.error(err, msg)` AND `done()` or `done(err)`
- Never throw uncaught errors - wrap async operations in try/catch
- Clear error conditions with `done()` after `node.error()` for validation failures
- Pass errors to `done(err)` for runtime exceptions

### Testing Locally
```bash
npm install
npm link
cd ~/.node-red  # or C:\Users\username\.node-red on Windows
npm link node-red-contrib-postgres-pgvector
```

Restart Node-RED to load the module. Import [examples/basic-flows.json](examples/basic-flows.json) for testing.

### Before Publishing
- [ ] LICENSE file present in root
- [ ] README with prerequisites, installation steps, and usage examples  
- [ ] Node-RED version specified in package.json `node-red.version`
- [ ] All HTML help texts follow style guide with Inputs/Outputs/Details/Example sections
- [ ] Examples folder with `.json` flow files in root directory
- [ ] All nodes tested with example flows
- [ ] `node-red` keyword added to package.json (only when ready for publication)
