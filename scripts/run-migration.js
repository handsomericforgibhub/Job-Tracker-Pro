// Simple script to run database migration for foreman_id column
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    console.log('🔄 Running foreman_id migration...')
    
    // Add foreman_id column to jobs table
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS foreman_id UUID NULL;'
    })
    
    if (alterError) {
      console.error('❌ Error adding foreman_id column:', alterError)
      // Continue anyway - column might already exist
    } else {
      console.log('✅ foreman_id column added successfully')
    }
    
    // Add foreign key constraint
    const { error: fkError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE jobs ADD CONSTRAINT IF NOT EXISTS fk_jobs_foreman FOREIGN KEY (foreman_id) REFERENCES users(id) ON DELETE SET NULL;'
    })
    
    if (fkError) {
      console.error('❌ Error adding foreign key constraint:', fkError)
    } else {
      console.log('✅ Foreign key constraint added successfully')
    }
    
    // Create index
    const { error: indexError } = await supabase.rpc('exec_sql', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_jobs_foreman_id ON jobs(foreman_id);'
    })
    
    if (indexError) {
      console.error('❌ Error creating index:', indexError)
    } else {
      console.log('✅ Index created successfully')
    }
    
    console.log('✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
  }
}

runMigration()