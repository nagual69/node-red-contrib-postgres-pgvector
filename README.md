# @nagual69/node-red-pgvector

Node-RED nodes for PostgreSQL + pgvector: create vector tables, insert/upsert embeddings, run similarity search (cosine, L2, inner product), and manage indexes.

## Prerequisites

- **PostgreSQL** with the [pgvector extension](https://github.com/pgvector/pgvector) installed
- **Node-RED** version 2.0.0 or later
- **Node.js** version 18 or later

To install pgvector on PostgreSQL:
```sql
CREATE EXTENSION vector;
```

## Install

From the Node-RED palette manager, search for `@nagual69/node-red-pgvector` and click install.

Or install via npm in your Node-RED user directory (typically `~/.node-red`):
```bash
npm install @nagual69/node-red-pgvector
```

Restart Node-RED after installation.

## Nodes

### pgvector-config
Connection pooling configuration node for PostgreSQL. Configure once and reuse across all pgvector nodes.

**Configuration:**
- Host, port, database name
- User credentials (stored securely)
- SSL options
- Connection pool size

### pgvector-query
Run arbitrary SQL queries against PostgreSQL.

**Input:**
- `msg.sql` or `msg.topic` - SQL query string
- `msg.params` - Array of query parameters (optional)

**Output:**
- `msg.payload` - Array of result rows
- `msg.count` - Number of rows returned

### pgvector-insert
Insert rows with vector embeddings into a table.

**Input:**
- `msg.payload` - Single record or array of records with `vector` property
- `msg.table` - Target table name (optional, can be configured)
- `msg.column` - Vector column name (optional, can be configured)

**Example:**
```javascript
msg.payload = {
  vector: [0.1, 0.2, 0.3, ...],
  metadata: { title: "Document 1" }
};
```

### pgvector-upsert
Upsert (insert or update) rows with vector embeddings.

**Input:** Same as pgvector-insert
- Uses `ON CONFLICT` to update existing rows

### pgvector-search
Perform similarity search using various distance metrics.

**Input:**
- `msg.payload.vector` or `msg.vector` - Query embedding (array of floats)
- `msg.filter` - Object with key=value filters
- `msg.where` - Additional SQL WHERE clause
- `msg.limit` - Maximum results (default: 10)
- `msg.metric` - Distance metric: `cosine`, `l2`, or `inner-product`
- `msg.normalize` - Normalize vector before search (boolean)

**Vector formats supported:**
- Float arrays: `[0.1, 0.2, 0.3]`
- JSON strings: `"[0.1, 0.2, 0.3]"`
- Comma-separated: `"0.1, 0.2, 0.3"`
- Base64-encoded Float32Array

**Output:**
- `msg.payload` - Array of similar records with `similarity` scores

**Example:**
```javascript
msg.payload = {
  vector: [0.1, 0.2, 0.3, ...]
};
msg.filter = { category: "tech" };
msg.limit = 5;
```

### pgvector-schema
Inspect database schema to find tables and vector columns.

**Output:**
- `msg.payload` - Schema information including vector column dimensions

### pgvector-admin
Administrative operations for pgvector setup and index management.

**Actions:**
- `create-extension` - Install pgvector extension
- `create-table` - Create table with vector column
- `create-ivfflat` - Create IVFFlat index for approximate nearest neighbor search
- `create-hnsw` - Create HNSW index for approximate nearest neighbor search
- `set-probes` - Configure IVFFlat search quality
- `drop-index` - Remove an index

## Example Flows

Three ready-to-use example flows are provided in the [examples/](examples/) directory:

1. **[sample-flows.json](examples/sample-flows.json)** - **Start here!** Four separate tabs demonstrating all features:
   - Setup: Create extension, table, and HNSW index
   - Insert: Bulk insert articles with embeddings
   - Search: Similarity search with cosine/L2/inner-product metrics
   - Query: Custom SQL queries and data inspection

2. **[complete-example.json](examples/complete-example.json)** - End-to-end workflow with products table

3. **[basic-flows.json](examples/basic-flows.json)** - Simple starter template

**To import:** In Node-RED, use Menu → Import and select a flow file from the examples directory.

## Quick Start

1. **Add Configuration Node**
   - Drag a pgvector-search node to the canvas
   - Click the pencil icon next to "Connection"
   - Configure your PostgreSQL host, database, and credentials

2. **Setup Database**
   - Add a pgvector-admin node
   - Set action to "create-extension"
   - Deploy and trigger to install pgvector
   - Add another admin node with "create-table" action
   - Configure table name (e.g., "embeddings"), column name (e.g., "vector"), and dimension (e.g., 1536 for OpenAI embeddings)

3. **Insert Embeddings**
   - Use pgvector-insert or pgvector-upsert
   - Send messages with `msg.payload.vector` as your embedding array

4. **Search for Similar Vectors**
   - Use pgvector-search
   - Provide query vector in `msg.payload.vector`
   - Results in `msg.payload` with similarity scores

## Distance Metrics

- **cosine** (default) - Cosine similarity, best for normalized vectors
- **l2** - Euclidean distance (L2 norm)
- **inner-product** or **ip** - Inner product, useful for maximum inner product search

## Indexing for Performance

For large datasets (>10,000 vectors), create an index:

**IVFFlat** - Good balance of speed and accuracy:
- Use pgvector-admin with action "create-ivfflat"
- Set list parameter based on rows (sqrt of row count is a good starting point)

**HNSW** - Better recall, slower insert:
- Use pgvector-admin with action "create-hnsw"
- Generally provides better search quality

## Documentation

- **[Example Flows Guide](examples/README.md)** - Detailed walkthrough of all example flows
- **[Testing Guide](TESTING.md)** - Comprehensive testing procedures and troubleshooting
- **[pgvector Extension Docs](https://github.com/pgvector/pgvector)** - Vector database operations
- **[Node-RED Documentation](https://nodered.org/docs)** - Flow development and deployment

## Development

### Local Testing

```bash
npm install
npm link
# In Node-RED directory
cd ~/.node-red
npm link @nagual69/node-red-pgvector
```

### Docker Testing

```bash
cd test
docker-compose up -d
# Node-RED available at http://localhost:1880
```

### Project Structure

```
pgvector.js              # Main entry point registering all nodes
package.json             # NPM package manifest with @nagual69 scope
index.d.ts              # TypeScript type definitions
README.md               # This file
TESTING.md              # Comprehensive testing guide
LICENSE                 # MIT license
.gitignore              # Git ignore rules

nodes/                  # Node implementations (7 files)
├── pgvector-config.js/html
├── pgvector-admin.js/html
├── pgvector-query.js/html
├── pgvector-insert.js/html
├── pgvector-upsert.js/html
├── pgvector-search.js/html
└── pgvector-schema.js/html

lib/                    # Utility libraries
├── client.js           # Connection pool management
└── vector-utils.js     # Vector parsing, validation, operators

examples/               # Ready-to-import example flows
├── sample-flows.json   # Complete feature demonstration (4 tabs)
├── complete-example.json # End-to-end workflow
├── basic-flows.json    # Minimal starter
└── README.md          # Example flow documentation

test/                   # Docker test environment
├── docker-compose.yml  # PostgreSQL + Node-RED
├── init.sql           # Database initialization
└── README.md          # Testing instructions
```

### Code Patterns

**Node Implementation Pattern:**
- All nodes follow standard Node-RED structure
- Use `withClient(pool, fn)` for database operations
- Call `node.error(err, msg)` AND `done(err)` for error handling
- Set `node.status()` for visual feedback (blue=processing, red=error)
- Properties use non-conflicting names (e.g., `nodeMetric` not `metric`)

**Vector Utility Functions:**
- `parseVector()` - Accepts arrays, JSON strings, CSV, base64
- `normalizeVector()` - L2 normalization for cosine similarity
- `validateDimension()` - Ensures vector matches configured dimension
- `buildSimilarityQuery()` - Generates parameterized SQL with correct operators

### Contributing

1. Ensure all nodes follow error handling pattern
2. Test with provided Docker environment
3. Update examples if adding features
4. Add tests to TESTING.md
5. Update TypeScript definitions in index.d.ts

## License

MIT - See [LICENSE](LICENSE)
