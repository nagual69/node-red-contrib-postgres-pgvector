# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Node-RED contrib package for PostgreSQL + pgvector vector similarity operations. Pure JavaScript, no build step required.

## Commands

```bash
# Install dependencies
npm install

# Run tests
npm test                    # All tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests (requires PostgreSQL)

# Local development (link to Node-RED)
npm link
cd ~/.node-red  # or %USERPROFILE%\.node-red on Windows
npm link @nagual69/node-red-pgvector

# Docker test environment (PostgreSQL + Node-RED)
cd test && docker-compose up -d
# Access Node-RED at http://localhost:1880

# Preview package contents before publishing
npm pack --dry-run
```

## Architecture

**Entry point:** `pgvector.js` registers 7 node types via require() calls to `nodes/`.

**Node types:**
- `pgvector-config` - Credentials/connection pool management (stored in Node-RED vault)
- `pgvector-query` - Arbitrary SQL queries
- `pgvector-insert` / `pgvector-upsert` - Vector data insertion
- `pgvector-search` - Similarity search with cosine/L2/inner-product metrics
- `pgvector-schema` - Database schema inspection
- `pgvector-admin` - Extension/table/index management

**Libraries:**
- `lib/client.js` - `createPool()` and `withClient(pool, fn)` for connection lifecycle
- `lib/vector-utils.js` - Vector parsing, normalization, SQL query building, identifier escaping

## Node Implementation Pattern

Each node in `nodes/` follows this structure:

```javascript
'use strict';

const { withClient } = require('../lib/client');

module.exports = function registerNodeName(RED) {
  function NodeNameNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;

    // Cache configuration at construction time for performance
    const pgConfig = RED.nodes.getNode(config.connection);
    const nodeOption = config.option;

    node.on('input', async (msg, send, done) => {
      // 1. Validate connection
      if (!pgConfig || !pgConfig.pool) {
        node.error('No pgvector config provided', msg);
        done();
        return;
      }

      // 2. Merge node config with msg properties (msg overrides)
      const option = msg.option || nodeOption;

      try {
        // 3. Set status during operation
        node.status({ fill: 'blue', shape: 'dot', text: 'processing' });

        // 4. Execute database operation
        const result = await withClient(pgConfig.pool, (client) =>
          client.query(sql, params)
        );

        // 5. Send result and clear status
        msg.payload = result.rows;
        send(msg);
        node.status({});
        done();
      } catch (err) {
        // 6. Handle errors with status, error, and done
        node.status({ fill: 'red', shape: 'ring', text: 'error' });
        node.error(err, msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('node-name', NodeNameNode);
};
```

## Critical Conventions

- Always use `'use strict';` at top of each file
- Cache node configuration in constructor (not in input handler)
- Always call both `node.error(err, msg)` AND `done(err)` for proper error tracking
- Use `node.status({fill, shape, text})` for visual feedback (blue=processing, red=error)
- Implement `this.on('close', ...)` to call `pool.end()` in config nodes
- Preserve `msg` properties; only modify `msg.payload` for results
- Use parameterized SQL (`$1, $2...`) via pg driver - never string interpolation
- Use `escapeIdentifier()` from vector-utils for table/column/index names
- Use `Object.freeze()` for constant objects to prevent mutation

## Vector Handling

**Input formats accepted by `parseVector()`:** arrays, JSON strings, CSV, base64-encoded Float32Array

**Distance operators (from `buildSimilarityQuery()`):**
- `cosine` → `<=>` operator
- `l2` → `<->` operator
- `inner-product` / `ip` → `<#>` operator

## SQL Injection Protection

All identifier escaping uses `pg-format` via `escapeIdentifier()`:
- Table names, column names, index names are escaped
- Values use parameterized queries ($1, $2, etc.)
- Limit values are sanitized to numeric range [1, 10000]
- Probes values are sanitized to range [1, 100]

## Dependencies

- `pg` ^8.12.0 - node-postgres driver
- `pg-format` ^1.0.4 - SQL identifier escaping
- `pgvector` ^0.1.8 - provides `toSql()` for vector literal conversion
- Requires Node.js >=18, Node-RED >=2.0.0
- Requires PostgreSQL with `vector` extension installed
