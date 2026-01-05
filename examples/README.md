# Node-RED pgvector Example Flows

⚠️ These flows use example Docker credentials (`host: postgres`, `user: nodered`, `password: nodered123`) for local development only. Change them before using any external or shared database.

This directory contains ready-to-import Node-RED flows demonstrating all pgvector node capabilities. The flows are validated in the local Docker setup; update credentials and harden configs for any non-local use.

## Quick Start

1. Open Node-RED (default: http://localhost:1880)
2. Menu → Import → Select one of the JSON files below
3. Click Import to add the flow to your workspace
4. Configure the pgvector-config node with your PostgreSQL credentials (if not using Docker defaults)
5. Deploy and interact with the nodes

## Example Files

### 📌 sample-flows.json - **Recommended Starting Point**

Four separate tabs demonstrating the complete workflow:

#### Tab 1: "1. Setup Database"
Initialize pgvector and create the articles table.

**What it does:**
- Creates pgvector extension in PostgreSQL
- Creates `articles` table with columns: `id`, `title`, `content`, `embedding` (384-dim), `created_at`
- Creates HNSW index for fast similarity search

**To use:**
1. Click "Create Extension" button
2. Check debug panel for confirmation (payload: array[0])
3. Click "Create Articles Table" button
4. Click "Create HNSW Index" button

**Configuration:**
- Uses Docker credentials: `postgres` host, user `nodered`, password `nodered123` (local dev only; change in any other environment)
- Modify pgvector-config node if using different credentials

#### Tab 2: "2. Insert Embeddings"
Insert sample article data with embeddings.

**What it does:**
- Takes sample articles with small embedding arrays
- Pads embeddings to 384 dimensions (required by table schema)
- Bulk inserts 3 articles into the database

**To use:**
1. Click "Sample Articles" button
2. Check debug "Inserted IDs" panel for returned IDs

**Sample data:**
- "Machine Learning Basics" with intro text
- "PostgreSQL Tips" with database techniques
- "Vector Databases" with similarity search content

**Output:** Returns array of inserted record IDs

#### Tab 3: "3. Similarity Search"
Find similar articles using different distance metrics.

**What it does:**
- Takes a query vector (padded to 384 dimensions)
- Searches for top 5 most similar articles
- Calculates distance scores using three metrics

**Distance metrics demonstrated:**
- **Cosine** - Best for normalized vectors, values 0-2 (0=identical)
- **L2 (Euclidean)** - Euclidean distance, useful for dense vectors
- **Inner Product** - For maximum inner product search

**To use:**
Click "Search Similar Articles" button to run the default search. Each metric run produces different result orderings based on the distance calculation.

**Output:** Returns similar articles ranked by distance score

**Customization:**
- Modify the inject node's vector values to search with different embeddings
- Change the `limit` property to return more/fewer results

#### Tab 4: "4. Custom Queries"
Execute custom SQL queries against the database.

**What it does:**
- SELECT all articles with limit
- COUNT total articles in database
- Execute any arbitrary SQL

**To use:**
1. Click "Select All Articles" to retrieve article data
2. Click "Count Articles" to get total row count

**Output:** 
- SELECT: Returns array of record objects
- COUNT: Returns array with single object containing `total` field

**Customization:**
- Click the inject node's pencil icon to modify SQL queries
- Any valid PostgreSQL query works

---

### complete-example.json

Demonstrates a complete end-to-end workflow with a `products` table.

**Flow includes:**
- Sequence-based setup (extension → table → index in order)
- Sample product insertion (Electronics, Books, Clothing categories)
- Search with filter support (search only products in specific category)
- Statistics and analytics queries

**Best for:**
- Learning multi-step workflows
- Understanding how to structure complex flows
- Reference for category-filtered searches

**Configuration:**
- Uses Docker credentials (local dev only; change in any other environment)
- Table: `products` with `name`, `category`, and `embedding` columns
- Dimension: 384

---

### basic-flows.json

Simple starter template with minimal nodes.

**Flow includes:**
- Single config node
- Basic insert and search setup
- Good for beginners

**Best for:**
- Learning individual node functionality
- Creating custom flows from scratch
- Quick prototyping

---

## Testing the Flows

All flows have been tested in the included Docker environment. To test locally:

### Option 1: Docker Compose (Recommended)

```bash
cd test
docker-compose up -d
```

This starts:
- PostgreSQL 16 with pgvector extension
- Node-RED 4.1.2 with the pgvector package pre-installed

Then open http://localhost:1880 in your browser.

### Option 2: Manual PostgreSQL Setup

1. Install PostgreSQL with pgvector extension
2. Create database and user
3. Update pgvector-config credentials in flows
4. Import and test

---

## Embedding Dimensions

The sample flows use **384-dimensional vectors** (common for sentence transformers like SBERT).

To use different dimensions:
1. Update the dimension in pgvector-config
2. Update table creation SQL (change `vector(384)` to your dimension)
3. Ensure your embeddings match the configured dimension

Popular embedding dimensions:
- **OpenAI text-embedding-3-small/large**: 512 / 3072
- **Sentence Transformers (SBERT)**: 384
- **Cohere**: 1024
- **Google Vertex AI**: 768

---

## Troubleshooting

### "Column 'title' does not exist"
The table schema doesn't match the insert data. Check that your CREATE TABLE matches the data being inserted.

### "No pgvector config provided"
- Verify pgvector-config node exists
- Check that all nodes reference the correct config node
- Ensure config node credentials are valid

### "Embedding must be a vector"
- Verify vector is a float array `[0.1, 0.2, 0.3, ...]`
- Check vector length matches configured dimension
- Vector padding may be needed (see sample-flows padding function)

### Search returns no results
- Verify data was inserted (check "4. Custom Queries" → "Count Articles")
- Check table and column names match in search node config
- Ensure embedding column has data

---

## Next Steps

After running the sample flows:

1. **Connect to real embeddings:** Replace sample vectors with actual embeddings from OpenAI, HuggingFace, or other APIs
2. **Build your flow:** Use nodes as building blocks for your application
3. **Add indexes:** For >10k vectors, create appropriate indexes (sample shows HNSW)
4. **Monitor performance:** Use pgvector-schema to inspect table dimensions and indexes

---

## Documentation

- **Main README:** [../README.md](../README.md) - Node descriptions and API reference
- **Copilot Instructions:** [../.github/copilot-instructions.md](../.github/copilot-instructions.md) - Developer guide
- **pgvector Extension:** https://github.com/pgvector/pgvector - Vector operations docs

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
