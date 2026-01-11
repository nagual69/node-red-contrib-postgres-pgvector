# Node-RED pgvector Example Flows

These example flows demonstrate all pgvector node capabilities in the local Docker test environment.

**Credentials:** All flows use Docker test credentials (`host: postgres`, `user: nodered`, `password: nodered123`). Change these before using any external or shared database.

## Quick Start

1. Start the Docker environment: `cd test && docker-compose up -d`
2. Open Node-RED at http://localhost:1880
3. Menu → Import → Select one of the JSON files below
4. Click Import to add the flow to your workspace
5. Deploy and interact with the nodes

## Example Files

### sample-flows.json - Recommended Starting Point

Four separate tabs demonstrating the complete workflow. This is the most thoroughly tested example.

#### Tab 1: "1. Setup Database"

Initialize pgvector and create the articles table.

**What it does:**
- Creates pgvector extension in PostgreSQL
- Creates `articles` table with columns: `id`, `title`, `content`, `embedding` (384-dim), `created_at`
- Creates HNSW index for fast similarity search

**To use:**
1. Click "Create Extension" button
2. Click "Create Articles Table" button
3. Click "Create HNSW Index" button
4. Check debug panel for confirmation

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

#### Tab 3: "3. Similarity Search"

Find similar articles using cosine distance metric.

**What it does:**
- Takes a query vector (padded to 384 dimensions)
- Searches for top 5 most similar articles
- Returns distance scores

**To use:**
Click "Search Similar Articles" button to run the search.

**Customization:**
- Modify the inject node's vector values to search with different embeddings
- Change the `limit` property to return more/fewer results

#### Tab 4: "4. Custom Queries"

Execute custom SQL queries against the database.

**What it does:**
- SELECT all articles with limit
- COUNT total articles in database

**To use:**
1. Click "Select All Articles" to retrieve article data
2. Click "Count Articles" to get total row count

---

### complete-example.json - End-to-End Workflow

A single-tab flow demonstrating the complete workflow with a `products` table.

**Flow includes:**
- Step-by-step setup (extension → table → index)
- Sample product insertion (Electronics, Sports, Kitchen categories)
- Similarity search with result formatting
- Count and select queries

**Best for:**
- Learning multi-step workflows in a single view
- Understanding how to structure product-based flows
- Quick reference for all operations

---

### basic-flows.json - Minimal Starter

Simple single-tab template with the essential nodes.

**Flow includes:**
- Create table via pgvector-admin
- Insert vector with metadata
- Similarity search with cosine metric

**Best for:**
- Learning individual node functionality
- Creating custom flows from scratch
- Quick prototyping

---

## Testing the Flows

### Docker Compose (Recommended)

```bash
cd test
docker-compose up -d
```

This starts:
- PostgreSQL 16 with pgvector extension
- Node-RED with the pgvector package pre-installed

Open http://localhost:1880 in your browser.

### Manual PostgreSQL Setup

1. Install PostgreSQL with pgvector extension
2. Create database and user
3. Update pgvector-config credentials in flows
4. Import and test

---

## Embedding Dimensions

All sample flows use **384-dimensional vectors** (common for sentence transformers like SBERT).

To use different dimensions:
1. Update table creation SQL (change `vector(384)` to your dimension)
2. Update the padding function nodes
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
- Verify data was inserted (use "4. Custom Queries" → "Count Articles")
- Check table and column names match in search node config
- Ensure embedding column has data

### Connection refused
- Verify PostgreSQL is running (`docker-compose ps`)
- Check host/port in pgvector-config
- Ensure credentials are correct

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
- **Testing Guide:** [../TESTING.md](../TESTING.md) - Comprehensive testing procedures
- **pgvector Extension:** https://github.com/pgvector/pgvector - Vector operations docs
- **Node-RED Documentation:** https://nodered.org/docs/ - Flow development
