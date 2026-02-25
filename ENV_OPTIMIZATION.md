# Database Performance Optimization Guide

## 1. Connection Pool Configuration (CRITICAL)

Add to your `.env` file:

```bash
# Connection pool size (PostgreSQL)
# Formula: (CPU cores * 2) + 1 for single instance
# For 2-4 CPU cores: 9 connections
# For 4-8 CPU cores: 17 connections
# Increase if you have connection errors
DATABASE_URL="postgresql://user:pass@localhost:5432/db?connection_limit=20&pool_timeout=10&connect_timeout=5"
```

### Connection Limit Guidelines:
- **Small VPS (1-2 CPU)**: 9-13 connections
- **Medium VPS (2-4 CPU)**: 13-20 connections  
- **Large VPS (4+ CPU)**: 20-30 connections
- **Maximum**: PostgreSQL max_connections - 5 (reserved for admin)

Check current max_connections:
```sql
SHOW max_connections;
```

## 2. PostgreSQL Server Tuning

Add to `/etc/postgresql/16/main/postgresql.conf` (adjust version):

```ini
# Memory settings (for 4GB RAM server)
shared_buffers = 1GB                    # 25% of RAM
effective_cache_size = 3GB              # 75% of RAM
work_mem = 16MB                         # Per operation
maintenance_work_mem = 256MB            # For maintenance operations

# Connection settings
max_connections = 100                   # Default, adjust based on needs

# Checkpoint settings (for write-heavy workloads)
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query planner
random_page_cost = 1.1                  # For SSD storage
effective_io_concurrency = 200          # For SSD storage

# Logging slow queries
log_min_duration_statement = 1000       # Log queries > 1 second
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
```

Restart PostgreSQL after changes:
```bash
sudo systemctl restart postgresql
```

## 3. Regular Maintenance

Run these regularly (weekly):

```bash
# Analyze tables for query planner
sudo -u postgres psql -d grothi -c "ANALYZE;"

# Check for missing indexes
sudo -u postgres psql -d grothi -c "
SELECT 
  schemaname,
  tablename,
  attname as column,
  n_tup_read as reads,
  n_tup_fetch as fetches
FROM pg_stats 
WHERE schemaname = 'public'
ORDER BY n_tup_read DESC
LIMIT 20;
"

# Check table sizes
sudo -u postgres psql -d grothi -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
"
```

## 4. Monitoring Queries

Find slow queries:
```sql
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;
```

Enable pg_stat_statements if needed:
```bash
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

## 5. Index Verification

Check if indexes are used:
```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

## 6. Performance Checklist

- [ ] Connection pool size optimized
- [ ] PostgreSQL shared_buffers set to 25% RAM
- [ ] effective_cache_size set to 75% RAM
- [ ] work_mem appropriate for workload
- [ ] SSD optimized settings (random_page_cost = 1.1)
- [ ] Slow query logging enabled
- [ ] Regular ANALYZE scheduled
- [ ] pg_stat_statements enabled for monitoring

## 7. Quick Performance Test

```bash
# Test query performance
sudo -u postgres psql -d grothi -c "EXPLAIN ANALYZE 
  SELECT * FROM \"PostEngagement\" 
  WHERE \"botId\" = 'xxx' AND platform = 'INSTAGRAM' AND \"collectedAt\" IS NULL 
  LIMIT 50;"
```
