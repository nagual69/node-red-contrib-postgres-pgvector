# Quick Start Guide - @nagual69/node-red-pgvector

Get started with pgvector in Node-RED in **5 minutes**.

## 1. Install

### Option A: Node-RED Palette Manager (Easiest)
1. Open Node-RED
2. Click Menu (☰) → Manage palette
3. Search for `pgvector`
4. Click Install on `@nagual69/node-red-pgvector`
5. Restart Node-RED

### Option B: npm
```bash
npm install -g node-red
npm install @nagual69/node-red-pgvector
node-red
```

## 2. Setup Database

### Using Docker (Recommended)
```bash
cd node_modules/@nagual69/node-red-pgvector/test
docker-compose up -d
```

Wait 10 seconds for services to start, then open http://localhost:1880

**Credentials:** Host: `postgres`, User: `nodered`, Password: `nodered123`, DB: `vectordb`

### Using Existing PostgreSQL
1. Create database: `CREATE DATABASE vectordb;`
2. Install pgvector: `CREATE EXTENSION vector;`
3. Create user: `CREATE USER nodered WITH PASSWORD 'nodered123';`
4. Grant privileges: `GRANT ALL ON DATABASE vectordb TO nodered;`

## 3. Import Example Flow

1. In Node-RED, click Menu (☰) → Import
2. Paste this URL or copy the flow file:
   ```
   ~/.npm/_npx/[version]/lib/node_modules/@nagual69/node-red-pgvector/examples/sample-flows.json
   ```
3. Click Import
4. Click "1. Setup Database" tab

## 4. Configure Connection

1. Double-click the blue "pgvector-config-1" node
2. Set:
   - **Host:** `postgres` (Docker) or `localhost` (local)
   - **Port:** `5432`
   - **Database:** `vectordb`
   - **User:** `nodered`
   - **Password:** `nodered123`
3. Click Update

## 5. Run the Flows

### Tab 1: Setup Database
1. Click "Create Extension" button → Check debug (should say success)
2. Click "Create Articles Table" → Check debug
3. Click "Create HNSW Index" → Check debug

### Tab 2: Insert Embeddings
1. Click "Sample Articles" button
2. Check debug panel "Inserted IDs" - should show IDs: 1, 2, 3

### Tab 3: Similarity Search
1. Click "Search Similar Articles" 
2. Check debug panel - should show 3 results with distance scores
3. Try different buttons to see cosine/L2/inner-product results

### Tab 4: Custom Queries
1. Click "Select All Articles" - shows all inserted articles
2. Click "Count Articles" - shows total count

**All working? 🎉 You're ready to build with pgvector!**

---

## Next Steps

### 1. Use Real Embeddings
Replace sample vectors with real embeddings from:
- **OpenAI:** `text-embedding-3-small` (512-dim) or `text-embedding-3-large` (3072-dim)
- **Hugging Face:** Sentence Transformers (384-dim typical)
- **Cohere:** embed API (1024-dim)
- **Local:** Use `sentence-transformers` Python package

### 2. Build Your Flow
1. Add embedding API node (e.g., HTTP request to OpenAI)
2. Feed embeddings to pgvector-insert
3. Create pgvector-search for similarity queries
4. Build UI with Node-RED dashboard nodes

### 3. Learn More
- **Full Docs:** [README.md](node_modules/@nagual69/node-red-pgvector/README.md)
- **Example Walkthroughs:** [examples/README.md](node_modules/@nagual69/node-red-pgvector/examples/README.md)
- **Testing Guide:** [TESTING.md](node_modules/@nagual69/node-red-pgvector/TESTING.md)
- **pgvector Docs:** https://github.com/pgvector/pgvector

---

## Common Tasks

### Search Similar Items
```
Message: { payload: { vector: [0.1, 0.2, 0.3, ...] } }
         ↓ (pgvector-search node)
Result:  [ { id: 1, title: "Similar Item", distance: 0.15 }, ... ]
```

### Insert Data
```
Message: { payload: { vector: [0.1, 0.2, 0.3, ...], name: "Item" } }
         ↓ (pgvector-insert node)
Result:  [ { id: 1 }, { id: 2 }, ... ]
```

### Custom Query
```
Message: { topic: "SELECT * FROM table WHERE category = 'books'" }
         ↓ (pgvector-query node)
Result:  [ { id: 1, name: "Book", ... }, ... ]
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "No pgvector config provided" | Verify pgvector-config node exists and is selected in node dropdown |
| "Connection refused" | Check PostgreSQL is running and credentials are correct |
| "extension not found" | Run `CREATE EXTENSION vector;` in PostgreSQL |
| No search results | Insert data first (Tab 2), check COUNT in Tab 4 |
| Dimension error | Ensure embedding array length matches configured dimension |

---

## Example: Build a Semantic Search App

```
1. HTTP Input (user submits search query)
   ↓
2. OpenAI Embedding API (convert text to vector)
   ↓
3. pgvector-search (find similar items)
   ↓
4. Format Results (extract title, distance)
   ↓
5. HTTP Response (show to user)
```

**Time to implement:** ~30 minutes

---

## Support

- 📖 **Docs:** See package files in node_modules
- 🐛 **Issues:** Check TESTING.md troubleshooting section
- 📚 **Examples:** Import sample-flows.json from examples directory
- 🔗 **pgvector:** https://github.com/pgvector/pgvector

---

## What's Included

✅ 7 pgvector nodes for all operations  
✅ Complete example flows ready to import  
✅ Docker test environment  
✅ Comprehensive documentation  
✅ TypeScript definitions  
✅ MIT License  

**Happy building! 🚀**
