import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing RLS policies for job_status_history...')
    
    // Create admin client with service role key for database operations
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // SQL commands to fix RLS policies with comprehensive fix
    const sqlCommands = [
      // Drop existing policies
      'DROP POLICY IF EXISTS "Users can view job status history for their company\'s jobs" ON job_status_history;',
      'DROP POLICY IF EXISTS "Users can insert job status history for their company\'s jobs" ON job_status_history;',
      'DROP POLICY IF EXISTS "Users can update job status history for their company\'s jobs" ON job_status_history;',
      
      // Create new SELECT policy
      `CREATE POLICY "Users can view job status history for their company's jobs" 
       ON job_status_history FOR SELECT 
       USING (
           -- Allow access if user is site_admin
           (
               SELECT role FROM users WHERE id = auth.uid()
           ) = 'site_admin'
           OR
           -- Allow access if job belongs to user's company
           EXISTS (
               SELECT 1 FROM jobs 
               WHERE jobs.id = job_status_history.job_id 
               AND jobs.company_id = (
                   SELECT company_id FROM users WHERE id = auth.uid()
               )
           )
       );`,
       
      // Create new INSERT policy that allows system operations
      `CREATE POLICY "Users can insert job status history for their company's jobs" 
       ON job_status_history FOR INSERT 
       WITH CHECK (
           -- Always allow if there's no authenticated user (system/trigger context)
           auth.uid() IS NULL
           OR
           -- Allow if user is site_admin
           (
               SELECT role FROM users WHERE id = auth.uid()
           ) = 'site_admin'
           OR
           -- Allow if job belongs to user's company
           EXISTS (
               SELECT 1 FROM jobs 
               WHERE jobs.id = job_status_history.job_id 
               AND jobs.company_id = (
                   SELECT company_id FROM users WHERE id = auth.uid()
               )
           )
       );`,
       
      // Create UPDATE policy
      `CREATE POLICY "Users can update job status history for their company's jobs" 
       ON job_status_history FOR UPDATE 
       USING (
           -- Allow update if user is site_admin
           (
               SELECT role FROM users WHERE id = auth.uid()
           ) = 'site_admin'
           OR
           -- Allow update if job belongs to user's company
           EXISTS (
               SELECT 1 FROM jobs 
               WHERE jobs.id = job_status_history.job_id 
               AND jobs.company_id = (
                   SELECT company_id FROM users WHERE id = auth.uid()
               )
           )
       );`,
       
      // Add updated_by column to jobs table
      'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);',
      
      // Update trigger function to handle auth context properly
      `CREATE OR REPLACE FUNCTION log_job_status_change()
       RETURNS TRIGGER AS $$
       DECLARE
           current_user_id UUID;
       BEGIN
           -- Only log if status actually changed
           IF OLD.status IS DISTINCT FROM NEW.status THEN
               -- Try to get the current user, but don't fail if not available
               BEGIN
                   current_user_id := auth.uid();
               EXCEPTION 
                   WHEN OTHERS THEN
                       -- If auth.uid() fails, use the user who last updated the job
                       current_user_id := NEW.updated_by;
               END;
               
               -- Insert status history record
               INSERT INTO job_status_history (job_id, status, changed_by, changed_at)
               VALUES (NEW.id, NEW.status, current_user_id, NOW());
           END IF;
           RETURN NEW;
       END;
       $$ LANGUAGE plpgsql SECURITY DEFINER;`,
       
      // Recreate the trigger
      'DROP TRIGGER IF EXISTS trigger_log_job_status_change ON jobs;',
      `CREATE TRIGGER trigger_log_job_status_change
           AFTER UPDATE ON jobs
           FOR EACH ROW
           EXECUTE FUNCTION log_job_status_change();`,
           
      // Create the safe update function
      `CREATE OR REPLACE FUNCTION update_job_status_safely(
           p_job_id UUID, 
           p_new_status TEXT, 
           p_user_id UUID DEFAULT NULL,
           p_notes TEXT DEFAULT NULL
       )
       RETURNS BOOLEAN AS $$
       DECLARE
           job_exists BOOLEAN := false;
           user_has_access BOOLEAN := false;
           current_user_id UUID;
           job_company_id UUID;
           user_company_id UUID;
           user_role TEXT;
       BEGIN
           -- Set the user ID (use provided or try to get from auth context)
           current_user_id := COALESCE(p_user_id, auth.uid());
           
           -- Check if job exists and get company_id
           SELECT company_id INTO job_company_id 
           FROM jobs 
           WHERE id = p_job_id;
           
           IF job_company_id IS NULL THEN
               RAISE EXCEPTION 'Job not found: %', p_job_id;
           END IF;
           
           -- Get user's company and role
           SELECT company_id, role INTO user_company_id, user_role
           FROM users 
           WHERE id = current_user_id;
           
           -- Check access permissions
           IF user_role = 'site_admin' OR user_company_id = job_company_id THEN
               user_has_access := true;
           END IF;
           
           IF NOT user_has_access THEN
               RAISE EXCEPTION 'User does not have access to update this job';
           END IF;
           
           -- Update the job status
           UPDATE jobs 
           SET 
               status = p_new_status, 
               updated_at = NOW(),
               updated_by = current_user_id
           WHERE id = p_job_id;
           
           -- Manually add status history entry if needed (as backup)
           INSERT INTO job_status_history (job_id, status, changed_by, changed_at, notes)
           VALUES (p_job_id, p_new_status, current_user_id, NOW(), p_notes)
           ON CONFLICT DO NOTHING;
           
           RETURN true;
       END;
       $$ LANGUAGE plpgsql SECURITY DEFINER;`,
       
      // Grant permissions
      'GRANT EXECUTE ON FUNCTION update_job_status_safely(UUID, TEXT, UUID, TEXT) TO authenticated;',
      
      // Update existing jobs to set updated_by
      'UPDATE jobs SET updated_by = created_by WHERE updated_by IS NULL AND created_by IS NOT NULL;'
    ]
    
    // Execute each command
    for (let i = 0; i < sqlCommands.length; i++) {
      const command = sqlCommands[i]
      console.log(`📜 Executing SQL command ${i + 1}/${sqlCommands.length}...`)
      
      const { error } = await supabaseAdmin.rpc('exec_sql', { sql: command })
      
      if (error) {
        console.error(`❌ Error executing SQL command ${i + 1}:`, error)
        
        // If exec_sql doesn't work, try direct SQL execution
        try {
          const { error: directError } = await supabaseAdmin.from('pg_stat_statements').select('*').limit(1)
          if (directError) {
            console.log('Direct SQL execution also failed, trying alternative approach...')
          }
        } catch (e) {
          console.log('Alternative approach needed for SQL execution')
        }
        
        return NextResponse.json({ 
          error: `Failed to execute SQL command ${i + 1}`, 
          details: error,
          message: 'Database policies need to be updated manually in Supabase dashboard'
        }, { status: 500 })
      }
    }
    
    console.log('✅ All RLS policies updated successfully!')
    
    return NextResponse.json({ 
      message: 'RLS policies updated successfully',
      success: true 
    })
    
  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'You may need to manually update the RLS policies in the Supabase dashboard'
    }, { status: 500 })
  }
}