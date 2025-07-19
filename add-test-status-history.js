const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://iyfrjrudqjftkjvegevi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZnJqcnVkcWpmdGtqdmVnZXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwODkyNTYsImV4cCI6MjA2NjY2NTI1Nn0.507RbWemRfNpKnIyen4LWFROD5g5fZurGFkvH8fe2ls'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function addTestData() {
  console.log('Adding test status history data...')
  
  const jobId = '0dabaeb7-a13d-492a-9bb9-a916a52492c2'
  
  // Try to insert test status history
  const testHistory = [
    {
      job_id: jobId,
      status: 'planning',
      changed_at: '2025-07-14T00:00:00Z',
      changed_by: 'system',
      notes: 'Initial planning phase'
    },
    {
      job_id: jobId,
      status: 'active',
      changed_at: '2025-07-20T00:00:00Z',
      changed_by: 'system', 
      notes: 'Started work'
    },
    {
      job_id: jobId,
      status: 'on_hold',
      changed_at: '2025-08-15T00:00:00Z',
      changed_by: 'system',
      notes: 'Waiting for materials'
    },
    {
      job_id: jobId,
      status: 'active',
      changed_at: '2025-09-01T00:00:00Z',
      changed_by: 'system',
      notes: 'Resumed work'
    }
  ]
  
  for (const entry of testHistory) {
    const { data, error } = await supabase
      .from('job_status_history')
      .insert(entry)
    
    if (error) {
      console.log(`Failed to insert ${entry.status}: ${error.message}`)
    } else {
      console.log(`✓ Added ${entry.status} status`)
    }
  }
  
  // Test if we can read the data
  const { data, error } = await supabase
    .from('job_status_history')
    .select('*')
    .eq('job_id', jobId)
    .order('changed_at')
  
  if (error) {
    console.log('Error reading data:', error.message)
  } else {
    console.log('Status history data:', data)
  }
}

addTestData()