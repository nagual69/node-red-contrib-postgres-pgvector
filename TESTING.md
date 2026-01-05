# Testing Guide for node-red-contrib-postgres-pgvector

Comprehensive testing and validation procedures for the pgvector package.

## Test Environment Setup

### Docker Compose (Recommended)

The project includes a complete Docker Compose setup for testing:

```bash
cd test
docker-compose up -d
```

**Services:**
- **PostgreSQL 16** with pgvector extension on port 5432
  - Database: `vectordb`
  - User: `nodered`
  - Password: `nodered123`

- **Node-RED 4.1.2** on port 1880
  - Auto-installs the pgvector package
  - Pre-configured with test credentials

**Healthcheck:** PostgreSQL readiness is verified before Node-RED starts.

### Manual Setup

If not using Docker:

1. **Install PostgreSQL 16+**
   ```bash
   # macOS
   brew install postgresql

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib

   # Windows: Download from https://www.postgresql.org/download/windows/
   ```

2. **Install pgvector extension**
   ```sql
   CREATE EXTENSION vector;
   ```

3. **Create test database and user**
   ```sql
   CREATE DATABASE vectordb;
   CREATE USER nodered WITH PASSWORD 'nodered123';
   GRANT ALL PRIVILEGES ON DATABASE vectordb TO nodered;
   ```

4. **Install Node-RED**
   ```bash
   npm install -g node-red
   npm install -g node-red-contrib-postgres-pgvector
   ```

5. **Start Node-RED**
   ```bash
   node-red
   ```

## Test Procedures

### Test 1: pgvector-admin (Extension & Table Creation)

**Objective:** Verify extension installation and table creation

**Steps:**
1. Import `examples/sample-flows.json` into Node-RED
2. Open "1. Setup Database" tab
3. Click "Create Extension" button
4. Check debug panel: should show `payload: array[0]`
5. Click "Create Articles Table" button
6. Verify in database:
   ```sql
   \dt articles  -- Show table
   \d articles   -- Show columns
   ```

**Expected Result:**
- Table exists with columns: `id`, `title`, `content`, `embedding`, `created_at`
- Extension created successfully

**Failure Diagnosis:**
- Connection error → Check config node credentials
- Permission denied → Verify user privileges in PostgreSQL
- Extension exists → Re-run is safe (uses IF NOT EXISTS)

---

### Test 2: pgvector-admin (Index Creation)

**Objective:** Verify HNSW index creation with correct operator classes

**Steps:**
1. From "1. Setup Database" tab, click "Create HNSW Index"
2. Verify in database:
   ```sql
   \d articles
   -- Should show: articles_embedding_hnsw_idx HNSW (embedding vector_cosine_ops)
   
   SELECT * FROM pg_indexes WHERE tablename = 'articles';
   ```

**Expected Result:**
- Index created with operator class `vector_cosine_ops`
- Index method is `hnsw`

**Test Different Metrics:**
- Modify the inject node's metric property
- For L2: Should create with `vector_l2_ops`
- For inner-product: Should create with `vector_ip_ops`

**Failure Diagnosis:**
- "operator class does not exist" → Check metric spelling (cosine/l2/inner-product)
- Index not created → Check table exists first

---

### Test 3: pgvector-insert (Bulk Insert)

**Objective:** Verify data insertion with vector embeddings

**Steps:**
1. From "2. Insert Embeddings" tab, click "Sample Articles"
2. Check debug panel "Inserted IDs": should show 3 IDs
3. Verify in database:
   ```sql
   SELECT id, title FROM articles LIMIT 10;
   -- Should show 3 articles
   ```

**Expected Result:**
- All 3 articles inserted successfully
- IDs returned in payload array
- Vectors padded to 384 dimensions

**Test with Custom Data:**
1. Modify the inject node's payload
2. Change article titles/content
3. Re-click button to insert different data
4. Verify in database

**Failure Diagnosis:**
- "column 'title' does not exist" → Table schema mismatch
- Dimension error → Vector not padded correctly
- Connection error → Check config node

---

### Test 4: pgvector-search (Similarity Search)

**Objective:** Verify similarity search with all distance metrics

**Steps:**
1. From "3. Similarity Search" tab, click "Search Similar Articles" (default = cosine)
2. Check debug panel: should return 3 results with distance scores
3. Repeat 3 times using different metrics:
   - Cosine (default)
   - L2
   - Inner-product

**Expected Results:**
- Cosine: All distances in range 0-2 (0 = identical)
- L2: Euclidean distances, values vary
- Inner-product: Dot product values

Example output:
```json
[
  {
    "id": 2,
    "title": "PostgreSQL Tips",
    "distance": "0.2283"
  },
  {
    "id": 1,
    "title": "Machine Learning Basics",
    "distance": "0.2401"
  },
  {
    "id": 3,
    "title": "Vector Databases",
    "distance": "0.2562"
  }
]
```

**Test Vector Normalization:**
1. Click on the padding function node
2. Add normalization code
3. Enable `normalize: true` in search node
4. Verify results remain consistent

**Failure Diagnosis:**
- No results → Check data was inserted (Test 3)
- Wrong metric applied → Check search node metric property
- Distance is NaN → Vector format issue

---

### Test 5: pgvector-query (Custom Queries)

**Objective:** Verify arbitrary SQL execution

**Steps:**
1. From "4. Custom Queries" tab, click "Select All Articles"
2. Check debug panel: should return array of articles
3. Click "Count Articles"
4. Check debug panel: should return object with `total: "6"` (or your count)

**Expected Results:**
- SELECT returns array of record objects with id, title, content
- COUNT returns single object with `total` field
- `count` property shows row count

**Test Custom Queries:**
1. Click the "Select All Articles" inject node (pencil icon)
2. Modify the SQL:
   ```sql
   SELECT * FROM articles WHERE title LIKE '%PostgreSQL%'
   SELECT embedding FROM articles LIMIT 1
   SELECT dimension(embedding) FROM articles LIMIT 1
   ```
3. Click again to execute
4. Verify results in debug panel

**Failure Diagnosis:**
- "SQL is required" → msg.topic not set correctly
- Column not found → Check table schema
- Syntax error → Verify SQL is valid PostgreSQL

---

### Test 6: pgvector-schema (Schema Inspection)

**Objective:** Verify schema inspection capabilities

**Steps:**
1. Add pgvector-schema node to canvas
2. Send message with `msg.table = "articles"`
3. Check debug output: should show column definitions

**Expected Output:**
```json
[
  {"column_name": "id", "data_type": "integer"},
  {"column_name": "title", "data_type": "text"},
  {"column_name": "content", "data_type": "text"},
  {"column_name": "embedding", "data_type": "vector"},
  {"column_name": "created_at", "data_type": "timestamp without time zone"}
]
```

**Test without table parameter:**
1. Send message without table
2. Should return list of all tables in public schema

---

## Performance Testing

### Large Dataset Test

**Setup:**
```javascript
// Insert 10,000 random vectors
const records = [];
for (let i = 0; i < 10000; i++) {
  const vec = Array(384).fill(0).map(() => Math.random());
  records.push({
    vector: vec,
    name: `Item ${i}`,
    category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
  });
}
msg.payload = records;
```

**Metrics to measure:**
- Insert time for 10k records
- Query time without index
- Query time with HNSW index
- Memory usage in Node-RED

**Expected Performance:**
- Insert: 2-5 seconds
- Query (no index): 100-500ms
- Query (HNSW): 10-50ms

---

## Regression Testing

Run after any code changes:

1. **Test all 6 node types**
   - config, admin, insert, search, query, schema

2. **Test all distance metrics**
   - cosine, l2, inner-product

3. **Test all vector formats**
   - Float array: `[0.1, 0.2, 0.3]`
   - JSON string: `"[0.1, 0.2, 0.3]"`
   - CSV: `"0.1, 0.2, 0.3"`
   - Base64: Base64-encoded Float32Array

4. **Test error handling**
   - Missing config node
   - Invalid SQL
   - Missing required fields
   - Connection timeout

---

## CI/CD Integration

To integrate into CI/CD pipeline:

```bash
# Start test environment
cd test && docker-compose up -d

# Wait for services to be ready
sleep 10

# Run tests (customize as needed)
npm test

# Cleanup
docker-compose down
```

---

## Troubleshooting Common Issues

| Error | Cause | Solution |
|-------|-------|----------|
| "No pgvector config provided" | Config node not set | Verify all nodes reference correct config |
| "Connection refused" | PostgreSQL not running | Start PostgreSQL service |
| "extension not found" | pgvector not installed | Run `CREATE EXTENSION vector;` |
| "Embedding must be a vector" | Wrong dimension or format | Check embedding length and format |
| "operator class does not exist" | Wrong operator class name | Use: cosine→vector_cosine_ops |
| Index creation fails | Table doesn't exist | Create table first |
| Search returns no results | No data inserted | Insert data first (Test 3) |

---

## Test Coverage

Current test status (tested in Docker environment):

- ✅ pgvector-admin (extension, table, HNSW, IVFFlat, drop-index)
- ✅ pgvector-insert (single and bulk)
- ✅ pgvector-search (all 3 metrics, normalization, filtering)
- ✅ pgvector-query (SELECT, COUNT, custom SQL)
- ✅ pgvector-upsert (basic functionality)
- ✅ pgvector-schema (table and column inspection)
- ✅ pgvector-config (connection pooling, SSL options)
- ✅ All example flows (sample, complete, basic)

---

## Testing Checklist

Before publishing new version:

- [ ] All 6 nodes work with Docker environment
- [ ] All example flows import and execute successfully
- [ ] No console errors in Node-RED
- [ ] PostgreSQL logs show no errors
- [ ] Vector dimensions correctly validated
- [ ] Operator class mapping correct for all metrics
- [ ] Error messages are helpful
- [ ] Connection pooling works
- [ ] Credentials properly encrypted
- [ ] Tests pass on Node.js 18+
- [ ] Tests pass on Node-RED 2.0.0+

---

## Getting Help

If tests fail:

1. Check [../README.md](../README.md) for configuration details
2. Review [../.github/copilot-instructions.md](../.github/copilot-instructions.md) for architecture
3. Check pgvector docs: https://github.com/pgvector/pgvector
4. Review Node-RED docs: https://nodered.org/docs
