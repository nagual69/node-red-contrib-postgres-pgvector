# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-04

### Added

#### Features
- **7 Full-Featured Nodes** for pgvector operations
  - `pgvector-config` - Connection pooling and credentials management
  - `pgvector-admin` - Extension, table, and index management
  - `pgvector-query` - Arbitrary SQL query execution
  - `pgvector-insert` - Bulk vector insertion
  - `pgvector-upsert` - Insert or update with conflict handling
  - `pgvector-search` - Similarity search with 3 distance metrics
  - `pgvector-schema` - Database schema inspection

#### Vector Support
- Multiple input formats: arrays, JSON strings, CSV, base64-encoded
- Vector validation and dimension checking
- Automatic normalization for cosine similarity
- Flexible embedding dimensions (default 384 for sentence transformers)

#### Distance Metrics
- **Cosine** similarity (default) - `vector_cosine_ops` operator
- **L2** (Euclidean) distance - `vector_l2_ops` operator
- **Inner Product** - `vector_ip_ops` operator

#### Index Support
- **HNSW** indexes for best recall and query performance
- **IVFFlat** indexes for balanced speed/accuracy
- Configurable probe counts for IVFFlat

#### Example Flows
- **sample-flows.json** - Complete 4-tab feature demonstration
  - Tab 1: Database setup (extension, table, index)
  - Tab 2: Bulk insert with automatic vector padding
  - Tab 3: Similarity search with all 3 metrics
  - Tab 4: Custom SQL query execution
- **complete-example.json** - End-to-end workflow with products table
- **basic-flows.json** - Minimal starter template

#### Documentation
- **README.md** - Comprehensive user guide with node descriptions
- **examples/README.md** - Detailed example flow walkthrough
- **TESTING.md** - Complete testing procedures and troubleshooting
- **CHANGELOG.md** - Version history and changes
- **LICENSE** - MIT license
- **.gitignore** - Proper git ignore rules

#### Development
- **package.json** - Publication-ready metadata
  - Package name `@nagual69/node-red-pgvector`
  - Node-RED 2.0.0+ compatible
  - Proper author and repository fields
  - pgvector and pg dependencies specified

- **index.d.ts** - TypeScript type definitions
- **.github/copilot-instructions.md** - Developer guidelines
- **Docker Test Environment**
  - docker-compose.yml with PostgreSQL 16 + Node-RED 4.1.2
  - auto-setup and npm link integration
  - Health checks for service readiness

### Fixed

#### Node Property Conflicts
- Fixed `pgvector-admin.js` - Property conflicts with Node-RED Node class
  - Renamed internal variables: `nodeAction`, `nodeTable`, `nodeColumn`, `nodeMetric`, `nodeDimension`, `nodeIndexName`, `nodeProbes`
- Fixed `pgvector-search.js` - Same property conflict with `metric`
  - Renamed internal variable: `nodeMetric`

#### Operator Class Mapping
- Added correct pgvector operator class mapping in `pgvector-admin.js`
  - `cosine` → `vector_cosine_ops`
  - `l2` → `vector_l2_ops`
  - `inner-product`/`ip` → `vector_ip_ops`
- Fixes index creation errors with PostgreSQL

#### Sample Flow Issues
- Fixed SQL property passing in pgvector-query nodes
  - Using `msg.topic` for SQL strings (standard Node-RED convention)
  - Proper parameter passing via `msg.sql` or `msg.topic`
- Corrected table schema in sample flows
  - Added `title` and `content` columns alongside vector data
  - Proper `created_at` timestamp default

### Changed
- All HTML help files updated to Node-RED style guide standards
- All nodes categorized under 'pgvector' category
- Enhanced error messages with helpful context
- Improved SQL parameterization for security

### Tested
✅ All 7 nodes - Full functionality verified  
✅ All 3 distance metrics - cosine, L2, inner-product  
✅ All example flows - sample, complete, basic  
✅ Docker environment - PostgreSQL + Node-RED  
✅ Error handling - Proper error propagation  
✅ Connection pooling - Multiple concurrent connections  
✅ Vector formats - Arrays, JSON, CSV, base64  

## [Unreleased]

### Planned
- [ ] Support for cosine_normalized operator
- [ ] Batch vector updates
- [ ] Vector quantization support
- [ ] Performance metrics/monitoring nodes
- [ ] Clustering operations (k-means, etc.)
- [ ] Unit tests for all nodes
- [ ] CI/CD pipeline integration

---

## Installation & Usage

### Installation
```bash
# Via Node-RED Palette Manager
Search: @nagual69/node-red-pgvector

# Or via npm
npm install -g node-red
npm install @nagual69/node-red-pgvector
```

### Quick Start
1. Import `examples/sample-flows.json` into Node-RED
2. Configure pgvector-config with PostgreSQL credentials
3. Deploy and follow flow instructions

### Documentation
- [README.md](README.md) - Full API reference
- [examples/README.md](examples/README.md) - Example flow guide
- [TESTING.md](TESTING.md) - Testing procedures

---

## Contributors

- **@nagual69** - Original author and maintainer

## Support

- **Issues**: Report bugs on GitHub
- **Docs**: See README.md and example flows
- **Testing**: Follow TESTING.md procedures
- **License**: MIT

---

## References

- [pgvector GitHub](https://github.com/pgvector/pgvector) - Vector extension for PostgreSQL
- [Node-RED](https://nodered.org) - Flow-based programming for IoT
- [PostgreSQL](https://www.postgresql.org) - Advanced open source database

