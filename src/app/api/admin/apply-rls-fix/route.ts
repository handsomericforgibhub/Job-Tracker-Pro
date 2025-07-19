import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Starting RLS policy fix application...')
    
    // Get the current user to ensure only admins can run this
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is site_admin
    const { data: userProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!userProfile || userProfile.role !== 'site_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    console.log('✅ Admin verification passed')

    // Apply the RLS fix script step by step
    const steps = [
      {
        name: 'Drop existing policies',
        sql: `
          DROP POLICY IF EXISTS "Users can view job status history for their company's jobs" ON job_status_history;
          DROP POLICY IF EXISTS "Users can insert job status history for their company's jobs" ON job_status_history;
        `
      },
      {
        name: 'Create new SELECT policy',
        sql: `
          CREATE POLICY "Users can view job status history for their company's jobs" 
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
          );
        `
      },
      {
        name: 'Create new INSERT policy',
        sql: `
          CREATE POLICY "Users can insert job status history for their company's jobs" 
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
          );
        `
      },
      {
        name: 'Create UPDATE policy',
        sql: `
          CREATE POLICY "Users can update job status history for their company's jobs" 
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
          );
        `
      },
      {
        name: 'Update trigger function',
        sql: `
          CREATE OR REPLACE FUNCTION log_job_status_change()
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
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },
      {
        name: 'Recreate trigger',
        sql: `
          DROP TRIGGER IF EXISTS trigger_log_job_status_change ON jobs;
          CREATE TRIGGER trigger_log_job_status_change
              AFTER UPDATE ON jobs
              FOR EACH ROW
              EXECUTE FUNCTION log_job_status_change();
        `
      },
      {
        name: 'Add updated_by column',
        sql: `
          ALTER TABLE jobs ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);
        `
      },
      {
        name: 'Create safe update function',
        sql: `
          CREATE OR REPLACE FUNCTION update_job_status_safely(
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
          $$ LANGUAGE plpgsql SECURITY DEFINER;
        `
      },
      {
        name: 'Grant permissions',
        sql: `
          GRANT EXECUTE ON FUNCTION update_job_status_safely(UUID, TEXT, UUID, TEXT) TO authenticated;
        `
      },
      {
        name: 'Update existing jobs',
        sql: `
          UPDATE jobs 
          SET updated_by = created_by 
          WHERE updated_by IS NULL AND created_by IS NOT NULL;
        `
      }
    ]

    const results = []
    let successCount = 0

    for (const step of steps) {
      try {
        console.log(`🔄 Executing: ${step.name}`)
        
        const { error } = await supabase.rpc('execute_sql', { 
          sql_query: step.sql 
        })

        if (error) {
          console.error(`❌ Error in ${step.name}:`, error)
          results.push({
            step: step.name,
            success: false,
            error: error.message
          })
        } else {
          console.log(`✅ Success: ${step.name}`)
          results.push({
            step: step.name,
            success: true
          })
          successCount++
        }
      } catch (e) {
        console.error(`❌ Exception in ${step.name}:`, e)
        results.push({
          step: step.name,
          success: false,
          error: e.message
        })
      }
    }

    console.log(`🎉 RLS fix application completed: ${successCount}/${steps.length} steps successful`)

    return NextResponse.json({ 
      message: `RLS fix applied successfully: ${successCount}/${steps.length} steps completed`,
      results,
      success: successCount === steps.length
    })
  } catch (error) {
    console.error('❌ Error applying RLS fix:', error)
    return NextResponse.json({ 
      error: 'Failed to apply RLS fix', 
      details: error.message 
    }, { status: 500 })
  }
}