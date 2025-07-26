#!/usr/bin/env node

/**
 * Consolidated Database Migration Runner
 * 
 * This script runs the cleaned-up, consolidated database migrations
 * in the correct order with proper error handling and rollback support.
 * 
 * Usage:
 *   npm run db:migrate               # Run all pending migrations
 *   npm run db:migrate --dry-run     # Show what would be migrated
 *   npm run db:migrate --reset       # Reset and run all migrations
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs').promises
const path = require('path')

// Configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL')
  console.error('   SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})

// Migration files in execution order
const MIGRATIONS = [
  '01-core-database-setup.sql',
  '02-company-configuration-tables.sql', 
  '03-core-business-tables.sql',
  '04-question-driven-progression.sql', // To be created
  '05-document-management.sql',         // To be created
  '06-storage-and-uploads.sql',         // To be created
  '07-seed-default-data.sql'            // To be created
]

const MIGRATIONS_DIR = path.join(__dirname, '../database-scripts/consolidated')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

/**
 * Create schema_migrations table if it doesn't exist
 */
async function ensureMigrationsTable() {
  log('📋 Ensuring schema_migrations table exists...', colors.blue)
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER,
        applied_by TEXT DEFAULT current_user
      );
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_version 
      ON schema_migrations(version);
      
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
      ON schema_migrations(applied_at);
    `
  })
  
  if (error) {
    log(`❌ Failed to create schema_migrations table: ${error.message}`, colors.red)
    throw error
  }
  
  log('✅ Schema migrations table ready', colors.green)
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations() {
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('version')
    .order('applied_at')

  if (error) {
    log(`❌ Failed to get applied migrations: ${error.message}`, colors.red)
    throw error
  }

  return data.map(row => row.version)
}

/**
 * Check if a migration file exists
 */
async function migrationFileExists(filename) {
  try {
    await fs.access(path.join(MIGRATIONS_DIR, filename))
    return true
  } catch {
    return false
  }
}

/**
 * Read migration file content
 */
async function readMigrationFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename)
  const content = await fs.readFile(filePath, 'utf8')
  return content
}

/**
 * Execute a single migration
 */
async function executeMigration(filename, dryRun = false) {
  const version = filename.replace('.sql', '')
  
  log(`🔄 ${dryRun ? '[DRY RUN] ' : ''}Executing migration: ${version}`, colors.yellow)
  
  if (dryRun) {
    log(`   Would execute: ${filename}`, colors.cyan)
    return { success: true, executionTime: 0 }
  }
  
  const startTime = Date.now()
  
  try {
    const sql = await readMigrationFile(filename)
    
    // Execute the migration SQL
    const { error } = await supabase.rpc('exec_sql', { sql })
    
    if (error) {
      throw error
    }
    
    const executionTime = Date.now() - startTime
    
    // Record successful migration
    const { error: insertError } = await supabase
      .from('schema_migrations')
      .insert({
        version,
        execution_time_ms: executionTime
      })
    
    if (insertError && !insertError.message.includes('duplicate key')) {
      log(`⚠️  Migration executed but failed to record: ${insertError.message}`, colors.yellow)
    }
    
    log(`✅ Migration completed: ${version} (${executionTime}ms)`, colors.green)
    
    return { success: true, executionTime }
    
  } catch (error) {
    const executionTime = Date.now() - startTime
    
    log(`❌ Migration failed: ${version} (${executionTime}ms)`, colors.red)
    log(`   Error: ${error.message}`, colors.red)
    
    return { success: false, executionTime, error }
  }
}

/**
 * Reset database by dropping and recreating all tables
 */
async function resetDatabase() {
  log('🗑️  Resetting database...', colors.red)
  
  const resetSQL = `
    -- Drop all tables in reverse dependency order
    DROP TABLE IF EXISTS schema_migrations CASCADE;
    DROP TABLE IF EXISTS audit_logs CASCADE;
    DROP TABLE IF EXISTS time_entries CASCADE;
    DROP TABLE IF EXISTS tasks CASCADE;
    DROP TABLE IF EXISTS job_assignments CASCADE;
    DROP TABLE IF EXISTS worker_licenses CASCADE;
    DROP TABLE IF EXISTS worker_skills CASCADE;
    DROP TABLE IF EXISTS workers CASCADE;
    DROP TABLE IF EXISTS jobs CASCADE;
    DROP TABLE IF EXISTS projects CASCADE;
    DROP TABLE IF EXISTS company_color_schemes CASCADE;
    DROP TABLE IF EXISTS company_status_configs CASCADE;
    DROP TABLE IF EXISTS company_stages CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS companies CASCADE;
    
    -- Drop functions
    DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
    DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
    DROP FUNCTION IF EXISTS get_user_company_id() CASCADE;
    DROP FUNCTION IF EXISTS is_site_admin() CASCADE;
    DROP FUNCTION IF EXISTS has_company_access(UUID) CASCADE;
    DROP FUNCTION IF EXISTS get_company_stage_definitions(UUID) CASCADE;
    DROP FUNCTION IF EXISTS get_company_default_stage(UUID) CASCADE;
    DROP FUNCTION IF EXISTS get_company_stage_color(UUID, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS get_company_status_configs_by_type(UUID, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS get_company_status_config(UUID, TEXT, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS get_company_colors(UUID, TEXT) CASCADE;
    DROP FUNCTION IF EXISTS get_company_chart_colors(UUID) CASCADE;
    DROP FUNCTION IF EXISTS get_status_config_for_api(UUID, TEXT) CASCADE;
  `
  
  const { error } = await supabase.rpc('exec_sql', { sql: resetSQL })
  
  if (error) {
    log(`❌ Failed to reset database: ${error.message}`, colors.red)
    throw error
  }
  
  log('✅ Database reset completed', colors.green)
}

/**
 * Main migration runner
 */
async function runMigrations() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const reset = args.includes('--reset')
  
  log('🚀 Starting consolidated database migrations...', colors.bright)
  log(`   Mode: ${dryRun ? 'DRY RUN' : 'EXECUTE'}`, colors.cyan)
  
  try {
    // Reset database if requested
    if (reset && !dryRun) {
      await resetDatabase()
    }
    
    // Ensure migrations table exists
    if (!dryRun) {
      await ensureMigrationsTable()
    }
    
    // Get already applied migrations
    const appliedMigrations = dryRun ? [] : await getAppliedMigrations()
    
    log(`📊 Applied migrations: ${appliedMigrations.length}`, colors.blue)
    if (appliedMigrations.length > 0) {
      appliedMigrations.forEach(version => {
        log(`   ✓ ${version}`, colors.green)
      })
    }
    
    // Check which migrations need to be run
    const pendingMigrations = []
    
    for (const filename of MIGRATIONS) {
      const version = filename.replace('.sql', '')
      
      // Check if file exists
      if (!(await migrationFileExists(filename))) {
        log(`⚠️  Migration file not found: ${filename}`, colors.yellow)
        continue
      }
      
      // Check if already applied
      if (!appliedMigrations.includes(version)) {
        pendingMigrations.push(filename)
      }
    }
    
    if (pendingMigrations.length === 0) {
      log('✅ No pending migrations to run', colors.green)
      return
    }
    
    log(`📋 Pending migrations: ${pendingMigrations.length}`, colors.blue)
    pendingMigrations.forEach(filename => {
      log(`   • ${filename}`, colors.cyan)
    })
    
    // Execute pending migrations
    let totalExecutionTime = 0
    let successful = 0
    let failed = 0
    
    for (const filename of pendingMigrations) {
      const result = await executeMigration(filename, dryRun)
      
      totalExecutionTime += result.executionTime
      
      if (result.success) {
        successful++
      } else {
        failed++
        
        if (!dryRun) {
          log('❌ Migration failed - stopping execution', colors.red)
          break
        }
      }
    }
    
    // Summary
    log('', colors.reset)
    log('📊 Migration Summary:', colors.bright)
    log(`   Total migrations: ${pendingMigrations.length}`, colors.blue)
    log(`   Successful: ${successful}`, colors.green)
    log(`   Failed: ${failed}`, failed > 0 ? colors.red : colors.green)
    log(`   Total time: ${totalExecutionTime}ms`, colors.cyan)
    
    if (failed > 0) {
      process.exit(1)
    } else {
      log('✅ All migrations completed successfully!', colors.green)
    }
    
  } catch (error) {
    log(`❌ Migration runner failed: ${error.message}`, colors.red)
    console.error(error)
    process.exit(1)
  }
}

// Execute if run directly
if (require.main === module) {
  runMigrations()
}

module.exports = {
  runMigrations,
  executeMigration,
  getAppliedMigrations,
  resetDatabase
}