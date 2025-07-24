import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import { createClient } from '@supabase/supabase-js'

// Use service role key for administrative operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const postHandler = withAuth(async (request: NextRequest, user) => {
  try {
    console.log('🔧 Starting RLS policy fix for job_stages table')
    console.log('👤 Requested by:', user.email, 'Role:', user.role)

    // Only site admins can run this operation
    if (user.role !== 'site_admin') {
      return NextResponse.json({ 
        error: 'Only site administrators can fix RLS policies',
        user_role: user.role,
        required_role: 'site_admin'
      }, { status: 403 })
    }

    const sqlScript = `
-- Fix RLS Policies for job_stages Table
-- This script creates comprehensive RLS policies for job_stages table to allow proper stage management

-- =============================================
-- 1. DROP EXISTING POLICIES
-- =============================================

DROP POLICY IF EXISTS "Users can view stages" ON job_stages;
DROP POLICY IF EXISTS "Users can manage stages" ON job_stages;
DROP POLICY IF EXISTS "Site admins can manage all stages" ON job_stages;
DROP POLICY IF EXISTS "Owners can manage company stages" ON job_stages;
DROP POLICY IF EXISTS "Users can view company stages" ON job_stages;

-- =============================================
-- 2. CREATE COMPREHENSIVE RLS POLICIES
-- =============================================

-- SELECT Policy: Users can view global stages OR stages for their company OR if they're site admin
CREATE POLICY "Users can view stages" ON job_stages 
FOR SELECT USING (
  -- Global stages (company_id is null) are visible to all authenticated users
  company_id IS NULL 
  OR 
  -- Company-specific stages are visible to company members
  company_id = (SELECT company_id FROM users WHERE id = auth.uid())
  OR 
  -- Site admins can view all stages
  (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
);

-- INSERT Policy: Site admins and company owners can create stages
CREATE POLICY "Authorized users can create stages" ON job_stages 
FOR INSERT WITH CHECK (
  -- Site admins can create any stages (global or company-specific)
  (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
  OR
  -- Company owners can create stages for their own company
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
    AND 
    (
      -- Creating stage for their own company
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      -- Creating global stage (only if they're owner - rare case)
      company_id IS NULL
    )
  )
);

-- UPDATE Policy: Site admins and company owners can update stages
CREATE POLICY "Authorized users can update stages" ON job_stages 
FOR UPDATE USING (
  -- Site admins can update any stages
  (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
  OR
  -- Company owners can update stages for their own company or global stages
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
    AND 
    (
      -- Updating stage for their own company
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      -- Updating global stage
      company_id IS NULL
    )
  )
) WITH CHECK (
  -- Same check constraints for the updated data
  (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
  OR
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
    AND 
    (
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      company_id IS NULL
    )
  )
);

-- DELETE Policy: Site admins and company owners can delete stages
CREATE POLICY "Authorized users can delete stages" ON job_stages 
FOR DELETE USING (
  -- Site admins can delete any stages
  (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
  OR
  -- Company owners can delete stages for their own company or global stages
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
    AND 
    (
      -- Deleting stage for their own company
      company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      -- Deleting global stage
      company_id IS NULL
    )
  )
);

-- =============================================
-- 3. RELATED TABLE POLICIES
-- =============================================

-- Drop existing policies for stage_questions
DROP POLICY IF EXISTS "Users can view questions" ON stage_questions;

-- Create comprehensive policies for stage_questions
CREATE POLICY "Users can view stage questions" ON stage_questions 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM job_stages js 
    WHERE js.id = stage_questions.stage_id 
    AND (
      js.company_id IS NULL 
      OR js.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
    )
  )
);

CREATE POLICY "Authorized users can manage stage questions" ON stage_questions 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM job_stages js 
    WHERE js.id = stage_questions.stage_id 
    AND (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
        AND (
          js.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
          OR js.company_id IS NULL
        )
      )
    )
  )
);

-- Drop existing policies for stage_transitions
DROP POLICY IF EXISTS "Users can view transitions" ON stage_transitions;

-- Create comprehensive policies for stage_transitions
CREATE POLICY "Users can view stage transitions" ON stage_transitions 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM job_stages js 
    WHERE (js.id = stage_transitions.from_stage_id OR js.id = stage_transitions.to_stage_id)
    AND (
      js.company_id IS NULL 
      OR js.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
    )
  )
);

CREATE POLICY "Authorized users can manage stage transitions" ON stage_transitions 
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM job_stages js 
    WHERE (js.id = stage_transitions.from_stage_id OR js.id = stage_transitions.to_stage_id)
    AND (
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
      OR
      (
        (SELECT role FROM users WHERE id = auth.uid()) = 'owner'
        AND (
          js.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
          OR js.company_id IS NULL
        )
      )
    )
  )
);
    `

    console.log('🗂️ Executing RLS policy fix SQL script...')
    
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { 
      sql: sqlScript 
    })

    if (error) {
      // If exec_sql doesn't exist, try direct query execution
      console.log('⚠️ exec_sql function not available, trying direct execution')
      
      // Split the script into individual statements and execute them
      const statements = sqlScript
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

      const results = []
      let successCount = 0
      let errorCount = 0

      for (const statement of statements) {
        try {
          console.log(`🔄 Executing: ${statement.substring(0, 50)}...`)
          const { data: result, error: stmtError } = await supabaseAdmin
            .from('_dummy_') // This will fail but we can catch it
            .select('*')
          
          // Actually use rpc for raw SQL if available, otherwise manual policy creation
          const { data: policyResult, error: policyError } = await supabaseAdmin.rpc('exec', {
            sql: statement
          })
          
          if (policyError) {
            console.error(`❌ Statement failed: ${statement.substring(0, 50)}...`)
            console.error('Error:', policyError)
            errorCount++
            results.push({
              statement: statement.substring(0, 100) + '...',
              success: false,
              error: policyError.message
            })
          } else {
            console.log(`✅ Statement succeeded: ${statement.substring(0, 50)}...`)
            successCount++
            results.push({
              statement: statement.substring(0, 100) + '...',
              success: true
            })
          }
        } catch (err) {
          console.error(`❌ Unexpected error executing statement: ${statement.substring(0, 50)}...`)
          console.error('Error:', err)
          errorCount++
          results.push({
            statement: statement.substring(0, 100) + '...',
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      return NextResponse.json({
        success: errorCount === 0,
        message: errorCount === 0 ? 
          'RLS policies updated successfully' : 
          `Completed with ${successCount} successes and ${errorCount} errors`,
        executed_by: user.email,
        timestamp: new Date().toISOString(),
        statements_executed: statements.length,
        success_count: successCount,
        error_count: errorCount,
        results: results
      })
    }

    console.log('✅ RLS policy fix completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'RLS policies for job_stages updated successfully',
      executed_by: user.email,
      timestamp: new Date().toISOString(),
      data: data
    })

  } catch (error) {
    console.error('❌ Error fixing RLS policies:', error)
    return NextResponse.json({ 
      error: 'Failed to fix RLS policies',
      message: error instanceof Error ? error.message : 'Unknown error',
      executed_by: user.email,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}, ['site_admin'])

export const POST = postHandler