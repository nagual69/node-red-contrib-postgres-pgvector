# Testing Environment for node-red-pgvector

This directory contains a Docker Compose setup for local testing of the pgvector nodes.

## What's Included

- **PostgreSQL 16** with pgvector extension
- **Node-RED 4.1.2** (latest version)
- Pre-initialized test database with sample embeddings
- Automatic package linking for live development

## Quick Start

### 1. Start the Environment

```bash
cd test
docker-compose up -d
```

This will:
- Start PostgreSQL with pgvector on port 5432
- Initialize a test database with sample data
- Start Node-RED on port 1880
- Automatically link the pgvector package

### 2. Access Node-RED

Open your browser to: http://localhost:1880

The pgvector nodes should already be available in the palette under the "analysis" category.

### 3. Connection Details

Use these settings in the pgvector-config node:

- **Host**: `postgres` (or `localhost` if connecting from outside Docker)
- **Port**: `5432`
- **Database**: `vectordb`
- **User**: `nodered`
- **Password**: `nodered123`

### 4. Test Data

The database includes a `test_embeddings` table with:
- 5 sample records with 384-dimensional vectors
- Fields: `id`, `content`, `category`, `embedding`, `created_at`
- Pre-created HNSW index for fast similarity search

## Development Workflow

### Live Code Updates

The package directory is mounted into the container. To test changes:

```bash
# Make changes to your node code
# Restart Node-RED to pick up changes
docker-compose restart nodered
```

### View Logs

```bash
# All services
docker-compose logs -f

# Just Node-RED
docker-compose logs -f nodered

# Just PostgreSQL
docker-compose logs -f postgres
```

### Database Access

Connect to PostgreSQL directly:

```bash
docker-compose exec postgres psql -U nodered -d vectordb
```

Useful queries:
```sql
-- View all embeddings
SELECT id, content, category FROM test_embeddings;

-- Check vector dimensions
SELECT id, array_length(embedding::real[], 1) as dims FROM test_embeddings;

-- Manual similarity search
SELECT id, content, embedding <=> '[0.1,0.1,...]'::vector as distance 
FROM test_embeddings 
ORDER BY distance 
LIMIT 5;
```

## Testing Checklist

- [ ] Import example flow from `../examples/basic-flows.json`
- [ ] Configure pgvector-config with connection details above
- [ ] Test pgvector-search with sample query vector
- [ ] Test pgvector-insert with new embedding
- [ ] Test pgvector-admin for index creation
- [ ] Test pgvector-query with custom SQL
- [ ] Verify error handling (invalid vectors, missing params)

## Cleanup

Stop and remove containers:
```bash
docker-compose down
```

Remove volumes (deletes all data):
```bash
docker-compose down -v
```

## Troubleshooting

### Nodes not appearing in palette

```bash
docker-compose exec nodered sh -c "cd /data && npm link @nagual69/node-red-pgvector"
docker-compose restart nodered
```

### Connection refused to PostgreSQL

Wait for PostgreSQL to be ready (check with `docker-compose logs postgres`), then restart Node-RED:
```bash
docker-compose restart nodered
```

### Reset everything

```bash
docker-compose down -v
docker-compose up -d
```

## Custom Configuration

Edit `docker-compose.yml` to:
- Change ports if 1880 or 5432 are in use
- Modify PostgreSQL credentials (update `init.sql` accordingly)
- Adjust Node-RED settings

Edit `init.sql` to:
- Create different test tables
- Use different vector dimensions
- Add more sample data
