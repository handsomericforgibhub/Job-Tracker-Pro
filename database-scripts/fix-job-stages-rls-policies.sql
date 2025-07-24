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

-- Also need to update related table policies for stage_questions and stage_transitions

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

-- =============================================
-- 4. VERIFICATION QUERIES
-- =============================================

-- Query to verify policies are working (run these manually to test)
/*
-- Test as site admin
SELECT 'Site admin should see all stages' as test_case, count(*) as stage_count FROM job_stages;

-- Test as company owner  
SELECT 'Owner should see global + company stages' as test_case, count(*) as stage_count 
FROM job_stages 
WHERE company_id IS NULL OR company_id = (SELECT company_id FROM users WHERE id = auth.uid());

-- Test insert permission
INSERT INTO job_stages (name, description, color, sequence_order, maps_to_status, company_id, created_by)
VALUES ('Test Stage', 'Test Description', '#FF0000', 999, 'planning', 
        (SELECT company_id FROM users WHERE id = auth.uid()), auth.uid());
*/

-- =============================================
-- 5. COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON POLICY "Users can view stages" ON job_stages IS 
'Allows users to view global stages and stages for their company. Site admins can view all stages.';

COMMENT ON POLICY "Authorized users can create stages" ON job_stages IS 
'Site admins can create any stages. Company owners can create stages for their company.';

COMMENT ON POLICY "Authorized users can update stages" ON job_stages IS 
'Site admins can update any stages. Company owners can update stages for their company or global stages.';

COMMENT ON POLICY "Authorized users can delete stages" ON job_stages IS 
'Site admins can delete any stages. Company owners can delete stages for their company or global stages.';