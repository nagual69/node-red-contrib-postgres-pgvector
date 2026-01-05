# Node-RED pgvector Example Flows

This directory contains ready-to-import Node-RED flows demonstrating pgvector capabilities.

## Available Flows

### 1. sample-flows.json - Complete Feature Set

Four separate tabs demonstrating different aspects:

#### Tab: "1. Setup Database"
Sets up pgvector with extension, table creation, and indexing.

**Steps:**
- Click "Create Extension" to install pgvector
- Click "Create Table" to create an articles table (384-dim vectors)
- Click "Create HNSW Index" to create a search index

**Use for:** Initial database setup

#### Tab: "2. Insert Embeddings"
Insert sample article embeddings into the database.

**Features:**
- Bulk insert multiple embeddings
- Automatic vector padding to 384 dimensions
- Returns generated IDs

**Use for:** Loading data

#### Tab: "3. Similarity Search"
Perform similarity searches with different distance metrics.

**Metrics demonstrated:**
- **Cosine** - Best for normalized vectors
- **L2** - Euclidean distance
- **Inner Product** - For maximum inner product search

**Use for:** Finding similar items

#### Tab: "4. Custom Queries"
Run custom SQL queries against the pgvector database.

**Examples:**
- Select all articles
- Count records
- Check vector dimensions

**Use for:** Data inspection and analytics

### 2. complete-example.json - End-to-End Workflow

A single integrated flow showing:
1. Database setup
2. Product insertion with embeddings
3. Similarity search on products
4. Database statistics

**Best for:** Understanding the complete workflow

## How to Import

### In Docker Container

1. Open Node-RED: http://localhost:1880
2. Click the **menu** (☰) in top-right
3. Select **Import**
4. Copy the JSON file contents from this directory
5. Paste into the import dialog
6. Click **Import**

### From File

1. Go to **Menu** → **Import**
2. Click **select a file to import**
3. Choose `sample-flows.json` or `complete-example.json`
4. Click **Import**

## Prerequisites

Before importing flows:

1. **Configure pgvector-config node:**
   - Double-click any pgvector node
   - Click the pencil icon next to "Connection"
   - Set values (should auto-populate for Docker):
     - Host: `postgres`
     - Port: `5432`
     - Database: `vectordb`
     - User: `nodered`
     - Password: `nodered123`

2. **Deploy** the flow

## Quick Test Walkthrough

### Using sample-flows.json

1. Import the flows
2. Go to "1. Setup Database" tab
3. Click each inject node in order:
   - "Create Extension"
   - "Create Table"
   - "Create HNSW Index"
4. Check the debug panel for status
5. Go to "2. Insert Embeddings" tab
6. Click "Sample Articles" to insert data
7. Go to "3. Similarity Search" tab
8. Click any search button and check results
9. Go to "4. Custom Queries" tab
10. Run queries to verify data

## Vector Dimensions

- **Flows use 384-dimensional vectors** (common for sentence transformers)
- Automatically padded in function nodes
- Matches the test database schema

## Understanding the Flows

### Insert Flow
```
Inject Data → Pad Vectors → Insert Node → Debug Output
```

### Search Flow
```
Inject Query → Pad Vectors → Search Node → Format Results → Debug Output
```

### Query Flow
```
Inject SQL → Query Node → Debug Output
```

## Customization

### Change Vector Dimension

In any flow, modify the "Pad vectors to 384 dims" function node:
```javascript
// Change 384 to your desired dimension
while (padded.length < 384) {
```

### Change Table/Column Names

Edit inject nodes to specify:
- `msg.table` - Target table
- `msg.column` - Vector column name
- `msg.dimension` - Vector dimension (for create-table)

### Add Filters to Search

In the pgvector-search node, set:
- `msg.filter` - Object with key=value (e.g., `{category: "tech"}`)
- `msg.where` - Raw SQL WHERE clause

Example:
```javascript
msg.filter = { category: "tech" };
msg.limit = 10;
```

## Testing Against Live Data

### With Docker Test Database

The flows are pre-configured to use the test database:
- Database: `vectordb`
- Tables created: `test_embeddings`, `articles`, `products`
- Sample data: Pre-loaded in `test_embeddings`

Run sample-flows.json flows against existing data!

### With External PostgreSQL

1. Update pgvector-config with your connection details
2. Ensure pgvector extension is installed
3. Create tables matching the flow expectations
4. Adjust vector dimensions as needed

## Troubleshooting

### Connection refused
- Verify PostgreSQL is running
- Check host/port in pgvector-config
- Ensure credentials are correct

### Vector dimension mismatch
- Check table column definition
- Verify padding function matches dimension
- Use pgvector-schema to inspect existing tables

### No results from search
- Check table has data (use pgvector-query to count)
- Verify vector column name matches
- Try increasing similarity threshold in metrics

## Additional Resources

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Node-RED Documentation](https://nodered.org/docs/)
- [Similarity Search Concepts](https://en.wikipedia.org/wiki/Similarity_search)
