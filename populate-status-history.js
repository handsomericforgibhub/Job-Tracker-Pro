const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://iyfrjrudqjftkjvegevi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZnJqcnVkcWpmdGtqdmVnZXZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwODkyNTYsImV4cCI6MjA2NjY2NTI1Nn0.507RbWemRfNpKnIyen4LWFROD5g5fZurGFkvH8fe2ls'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function populateStatusHistory() {
  console.log('Populating status history for existing jobs...')
  
  try {
    // First, create the table if it doesn't exist
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS job_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'on_hold', 'completed', 'cancelled')),
        changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        changed_by TEXT DEFAULT 'system',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_job_status_history_job_id ON job_status_history(job_id);
      CREATE INDEX IF NOT EXISTS idx_job_status_history_changed_at ON job_status_history(changed_at);
    `
    
    // Try to create table using raw SQL (might not work due to permissions)
    try {
      await supabase.rpc('exec_sql', { sql: createTableSQL })
      console.log('✓ Table created successfully')
    } catch (error) {
      console.log('Table creation via RPC failed (expected):', error.message)
    }
    
    // Get all existing jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, status, created_at, created_by')
      .order('created_at')
    
    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return
    }
    
    console.log(`Found ${jobs.length} jobs to process`)
    
    // For each job, check if it has status history
    for (const job of jobs) {
      const { data: existingHistory, error: historyError } = await supabase
        .from('job_status_history')
        .select('id')
        .eq('job_id', job.id)
        .limit(1)
      
      if (historyError) {
        console.log(`Error checking history for job ${job.id}:`, historyError.message)
        continue
      }
      
      // If no history exists, create initial entry
      if (!existingHistory || existingHistory.length === 0) {
        console.log(`Creating initial status history for job: ${job.id}`)
        
        const { error: insertError } = await supabase
          .from('job_status_history')
          .insert({
            job_id: job.id,
            status: job.status,
            changed_at: job.created_at,
            changed_by: job.created_by || 'system',
            notes: 'Initial job status'
          })
        
        if (insertError) {
          console.error(`Failed to create history for job ${job.id}:`, insertError.message)
        } else {
          console.log(`✓ Created initial status history for job ${job.id}`)
        }
      } else {
        console.log(`✓ Job ${job.id} already has status history`)
      }
    }
    
    console.log('Status history population completed!')
    
  } catch (error) {
    console.error('Error populating status history:', error)
  }
}

populateStatusHistory()