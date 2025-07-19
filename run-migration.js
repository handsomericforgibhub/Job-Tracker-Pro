const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'database-scripts', '13-job-status-history.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('Running job status history migration...')
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL })
    
    if (error) {
      console.error('Migration failed:', error)
      process.exit(1)
    }
    
    console.log('Migration completed successfully!')
    
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

runMigration()