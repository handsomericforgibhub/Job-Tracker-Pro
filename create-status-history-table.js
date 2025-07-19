const { createClient } = require('@supabase/supabase-js')

// Hardcode the values from .env.local for this test
const supabaseUrl = 'https://iyfrjrudqjftkjvegevi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZnJqcnVkcWpmdGtqdmVnZXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwODkyNTYsImV4cCI6MjA2NjY2NTI1Nn0.507RbWemRfNpKnIyen4LWFROD5g5fZurGFkvH8fe2ls'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createTable() {
  console.log('Creating job_status_history table...')
  
  // First, try to create the table using a simple SQL query
  const { data, error } = await supabase
    .from('job_status_history')
    .select('id')
    .limit(1)

  if (error && error.code === '42P01') { // Table does not exist
    console.log('Table does not exist. Let me try to check if we can create it...')
    
    // Try to insert a test record to see if table exists
    const { error: insertError } = await supabase
      .from('job_status_history')
      .insert({
        job_id: '00000000-0000-0000-0000-000000000000',
        status: 'planning',
        changed_by: 'system',
        notes: 'test'
      })
    
    if (insertError) {
      console.error('Cannot create table via API. Please run the SQL script manually.')
      console.log('Go to your Supabase dashboard > SQL Editor and run:')
      console.log('File: database-scripts/13-job-status-history.sql')
      process.exit(1)
    }
  } else {
    console.log('Table already exists or can be accessed!')
  }
}

createTable()