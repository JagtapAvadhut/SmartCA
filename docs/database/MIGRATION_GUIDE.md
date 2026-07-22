# Migration Guide: In-Memory to PostgreSQL

## Overview

This guide documents the migration of Smart CA from an in-memory mock database to PostgreSQL.

## Architecture Changes

### Before (In-Memory)

```
Browser → React → REST API → Handlers → Services → Memory Store → In-Memory Maps
```

### After (PostgreSQL)

```
Browser → React → REST API → Handlers → Services → Repository Interface → PostgreSQL Repository → PostgreSQL
```

## Key Changes

### 1. Database Layer

**Before:**
- Data stored in memory using Go maps
- Data lost on application restart
- No persistent storage

**After:**
- Data stored in PostgreSQL
- Persistent storage
- ACID compliance
- Proper transactions

### 2. Repository Pattern

The application maintains the Repository Pattern with a clean interface:

```go
type Store interface {
    Get(collection, id string) (models.Record, error)
    Create(collection string, rec models.Record) (models.Record, error)
    Update(collection, id string, patch models.Record) (models.Record, error)
    Archive(collection, id string) error
    Restore(collection, id string) error
    // ... other methods
}
```

Both `memory.Store` and `postgres.Store` implement this interface.

### 3. Configuration

**New Environment Variables:**

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=smartca
DB_PASSWORD=smartca123
DB_NAME=smartca
DB_SSLMODE=disable
DB_MAX_OPEN_CONNS=25
DB_MAX_IDLE_CONNS=5
DB_CONN_MAX_LIFETIME=5
```

### 4. Schema Design

All collections have been mapped to proper PostgreSQL tables with:

- Primary keys
- Foreign keys
- Indexes for performance
- Timestamps (created_at, updated_at)
- Soft delete support (deleted_at)
- JSONB columns for flexible fields (tags, services, etc.)

#### Table Structure

| Collection | Table Name | Key Fields |
|------------|------------|------------|
| users | users | id (PK), employee_id (FK), role (FK) |
| roles | roles | id (PK) |
| permissions | permissions | id (PK) |
| clients | clients | id (PK), assigned_to (FK) |
| companies | companies | id (PK), client_id (FK) |
| employees | employees | id (PK), role (FK) |
| invoices | invoices | id (PK), client_id (FK), created_by (FK) |
| invoice_items | invoice_items | id (PK), invoice_id (FK) |
| payments | payments | id (PK), invoice_id (FK), client_id (FK) |
| documents | documents | id (PK), client_id (FK), uploaded_by (FK) |
| tasks | tasks | id (PK), client_id (FK), assigned_to (FK) |
| notes | notes | id (PK), client_id (FK), created_by (FK) |
| gst | gst | id (PK), client_id (FK), filed_by (FK) |
| itr | itr | id (PK), client_id (FK), filed_by (FK) |
| tds | tds | id (PK), client_id (FK), filed_by (FK) |
| roc | roc | id (PK), company_id (FK), filed_by (FK) |
| activities | activities | id (PK), user_id (FK) |
| audit_logs | audit_logs | id (PK), user_id (FK) |
| calendar_events | calendar_events | id (PK), client_id (FK), created_by (FK) |
| notifications | notifications | id (PK), user_id (FK) |
| sessions | sessions | id (PK), user_id (FK) |
| settings | settings | id (PK), key (UNIQUE) |

### 5. Migration System

The application includes an automatic migration system:

- Migrations are stored in `Go/migrations/`
- Format: `NNN_description.up.sql` and `NNN_description.down.sql`
- Applied automatically on application startup
- Tracks applied migrations in `schema_migrations` table

### 6. Seed Data

Seed data is automatically loaded on first run:

1. Application checks if users table is empty
2. If empty, loads data from `Go/internal/seed/data/*.json`
3. Inserts data into PostgreSQL
4. Validates referential integrity

## Code Changes

### Services Layer

All services were updated to use `repository.Store` interface instead of concrete `*memory.Store`:

**Before:**
```go
type CRUDService struct {
    store *memory.Store
    collection string
}

func NewCRUDService(store *memory.Store, collection string) *CRUDService {
    return &CRUDService{store: store, collection: collection}
}
```

**After:**
```go
type CRUDService struct {
    store repository.Store
    collection string
}

func NewCRUDService(store repository.Store, collection string) *CRUDService {
    return &CRUDService{store: store, collection: collection}
}
```

### Main Application

**Before:**
```go
store := memory.NewStore()
store.Reset(data)
```

**After:**
```go
db, err := database.Connect(cfg.DBConnectionString(), ...)
store := postgres.NewStore(db)

// Run migrations
database.Migrate(db, migrationsDir)

// Load seed data if empty
if store.Count(services.ColUsers, false) == 0 {
    data, _ := seed.LoadSeed()
    store.Reset(data)
}
```

## Data Migration

### From Development (In-Memory)

If you have been using the in-memory store and want to preserve data:

1. The in-memory data is reset on every restart
2. Export any custom data you need
3. Update seed JSON files if needed
4. PostgreSQL will load fresh seed data on first run

### From Another PostgreSQL Instance

Use standard PostgreSQL tools:

```bash
# Export
pg_dump -U smartca -d smartca > backup.sql

# Import
psql -U smartca -d smartca < backup.sql
```

## Testing Strategy

### 1. Unit Tests

All existing tests continue to work with the repository interface:

```bash
go test ./...
```

### 2. Integration Tests

Test with real PostgreSQL:

```bash
go test ./... -tags=integration
```

### 3. API Testing

Test all endpoints:

```bash
# Health check
curl http://localhost:8080/api/v1/health

# Auth
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"rsharma01","password":"SmartCA@2025"}'

# List clients
curl http://localhost:8080/api/v1/clients \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance Considerations

### Indexes

All tables have appropriate indexes on:
- Primary keys (automatic)
- Foreign keys
- Frequently queried fields (status, dates, etc.)
- Search fields (name, email, etc.)

### Connection Pooling

Configured via environment variables:
- `DB_MAX_OPEN_CONNS`: Maximum number of open connections (default: 25)
- `DB_MAX_IDLE_CONNS`: Maximum number of idle connections (default: 5)
- `DB_CONN_MAX_LIFETIME`: Maximum connection lifetime in minutes (default: 5)

### Query Optimization

- Use prepared statements (handled by lib/pq)
- Avoid N+1 queries
- Use transactions for multiple operations
- Monitor slow queries with `EXPLAIN ANALYZE`

## Rollback Plan

If you need to rollback to in-memory:

1. Change import in `main.go`:
   ```go
   // import "github.com/JagtapAvadhut/smartca-backend/internal/repository/postgres"
   import "github.com/JagtapAvadhut/smartca-backend/internal/repository/memory"
   ```

2. Update store initialization:
   ```go
   store := memory.NewStore()
   store.Reset(data)
   ```

3. Rebuild: `go build -o smartca.exe ./cmd/api`

## Known Issues and Limitations

### 1. JSONB Fields

Some complex fields (tags, services, permissions) use JSONB:
- Pro: Flexible schema
- Con: Harder to query with complex filters

### 2. Transactions

The `WithTx` method has been simplified for PostgreSQL:
- All operations within a transaction share the same connection
- Nested transactions are not supported

### 3. ID Generation

IDs continue to use the application-generated format (e.g., "CLT-0001"):
- Not using PostgreSQL's SERIAL or UUID
- Maintains compatibility with existing frontend code

## Future Enhancements

### Potential Improvements

1. **Migration to UUIDs**: Consider using PostgreSQL UUID type for IDs
2. **Full-Text Search**: Use PostgreSQL's full-text search instead of LIKE queries
3. **Materialized Views**: For complex reporting queries
4. **Partitioning**: For large tables (audit_logs, activities)
5. **Read Replicas**: For scaling read operations
6. **Connection Pooling**: Use pgBouncer for production deployments

### Monitoring

Consider adding:
- Query performance monitoring
- Connection pool metrics
- Slow query logging
- Database size alerts

## Support

For issues or questions:
1. Check the [DATABASE_SETUP.md](DATABASE_SETUP.md) guide
2. Review PostgreSQL logs
3. Check application logs
4. Verify `.env` configuration

## Changelog

### Version 2.0.0 - PostgreSQL Migration

**Added:**
- PostgreSQL database support
- Automatic migrations
- Connection pooling
- Proper schema with constraints
- Soft delete support
- Transaction support

**Changed:**
- Repository interface to support both memory and PostgreSQL
- Service layer to use interface instead of concrete type
- Configuration to include database settings
- Main application to initialize PostgreSQL

**Maintained:**
- All existing API endpoints
- Frontend compatibility
- Seed data structure
- Repository pattern
- Service layer architecture
