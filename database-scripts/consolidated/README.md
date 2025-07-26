# Consolidated Database Migrations

This directory contains the cleaned-up, consolidated database migration scripts for JobTracker Pro. These scripts replace the numerous duplicate and variant scripts in the parent directory.

## Migration Files

| File | Order | Description | Dependencies |
|------|-------|-------------|--------------|
| `01-core-database-setup.sql` | 1 | Companies, users, RLS policies, audit system | None |
| `02-company-configuration-tables.sql` | 2 | Dynamic stages, status configs, color schemes | 01 |
| `03-core-business-tables.sql` | 3 | Jobs, workers, projects, tasks, time tracking | 01, 02 |

## Usage

### Run All Migrations
```bash
npm run db:migrate
```

### Dry Run (Preview)
```bash
npm run db:migrate:dry-run
```

### Reset and Rebuild
```bash
npm run db:reset
```

## Migration Architecture

### 1. Core Database Setup (`01-core-database-setup.sql`)
- **Companies table** - Root of multi-tenancy
- **Users table** - Company-scoped user profiles  
- **RLS helper functions** - Security policy utilities
- **RLS policies** - Data isolation enforcement
- **User auto-creation trigger** - Auth integration
- **Audit logs table** - Comprehensive change tracking

### 2. Company Configuration Tables (`02-company-configuration-tables.sql`)
- **Company stages** - Dynamic job progression stages
- **Company status configs** - Customizable status definitions
- **Company color schemes** - Branded UI color palettes
- **Configuration helper functions** - API utilities

### 3. Core Business Tables (`03-core-business-tables.sql`)
- **Projects** - Job groupings with client tracking
- **Jobs** - Primary work units with multi-stage support
- **Workers** - Employees/contractors with skills
- **Worker skills** - Competency tracking
- **Worker licenses** - Certification management
- **Job assignments** - Worker-to-job relationships
- **Tasks** - Work items within jobs
- **Time entries** - Time tracking with approval workflow

## Security Model

### Multi-Tenancy
- Every table has `company_id` field
- Row Level Security (RLS) enforces data isolation
- Helper functions validate company access
- Site admins can access all companies

### RLS Helper Functions
- `get_user_company_id()` - Get current user's company
- `is_site_admin()` - Check site admin privileges  
- `has_company_access(company_id)` - Validate company access

### RLS Policies
All company-scoped tables use the pattern:
```sql
CREATE POLICY "table_access_policy" ON table_name
  FOR ALL USING (has_company_access(company_id));
```

## Configuration System

### Dynamic Stages
Replaces hard-coded stage definitions:
```sql
-- Get company stages
SELECT * FROM get_company_stage_definitions('company-uuid');

-- Get default stage
SELECT * FROM get_company_default_stage('company-uuid');
```

### Dynamic Status Configs
Replaces hard-coded status mappings:
```sql
-- Get job status configs
SELECT * FROM get_company_status_configs_by_type('company-uuid', 'job');

-- Get single status config
SELECT * FROM get_company_status_config('company-uuid', 'job', 'active');
```

### Dynamic Colors
Replaces hard-coded color schemes:
```sql
-- Get stage colors
SELECT * FROM get_company_colors('company-uuid', 'stage');

-- Get chart colors
SELECT * FROM get_company_chart_colors('company-uuid');
```

## Audit System

### Comprehensive Logging
- All data changes logged in `audit_logs` table
- Includes old/new values, user, IP, timestamp
- Company-scoped with RLS policies

### Audit Fields
Standard audit fields on all tables:
- `created_at` - Creation timestamp
- `updated_at` - Last modification (auto-updated)
- `created_by` - User who created record

## Migration Management

### Schema Version Tracking
- `schema_migrations` table tracks applied migrations
- Prevents duplicate application
- Records execution time and user

### Rollback Support
- Each migration is atomic
- Failed migrations don't get recorded
- Database can be reset with `npm run db:reset`

### Execution Order
Migrations must be run in sequence due to dependencies:
1. Core setup creates foundational tables and functions
2. Configuration tables depend on companies/users
3. Business tables depend on configuration system

## Development Guidelines

### Adding New Migrations
1. Create new file: `04-descriptive-name.sql`
2. Add to `MIGRATIONS` array in `run-consolidated-migrations.js`
3. Include proper dependencies and comments
4. Test with dry-run first

### Migration Structure
```sql
-- ================================================
-- JobTracker Pro - Migration Description
-- ================================================
-- Order: XX
-- Dependencies: Previous migration files
-- Description: What this migration accomplishes
-- ================================================

-- Your SQL here

-- ================================================
-- SCRIPT COMPLETION
-- ================================================

INSERT INTO schema_migrations (version, applied_at) 
VALUES ('XX-migration-name', NOW())
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE new_table IS 'Description of purpose';
```

## Troubleshooting

### Environment Variables
Ensure these are set:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Permission Issues
- Service role key must have full database access
- RLS policies may need to be temporarily disabled for migrations

### Migration Failures
1. Check migration logs for specific SQL errors
2. Verify all dependencies are applied
3. Use `--dry-run` to test before execution
4. Consider `--reset` for clean slate (development only)

## Legacy Scripts

The parent `database-scripts/` directory contains legacy migration files with variants:
- `*-fixed.sql` - Bug fix versions
- `*-safe.sql` - Conservative versions  
- `*-refactored.sql` - Restructured versions
- `debug-*.sql` - Debugging utilities
- `test-*.sql` - Test scripts

These are preserved for reference but should not be used for new deployments. Use only the consolidated migrations in this directory.