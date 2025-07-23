-- Setup Job Stages Fix
-- This script ensures that job_stages table has the proper stages seeded
-- Run this if you're getting current_stage_id foreign key violations

BEGIN;

-- Check if job_stages table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'job_stages') THEN
        RAISE EXCEPTION 'job_stages table does not exist. Please run the question-driven-progression-schema.sql first.';
    END IF;
END $$;

-- Check if we have any stages
DO $$
DECLARE
    stage_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO stage_count FROM job_stages;
    
    IF stage_count = 0 THEN
        RAISE NOTICE 'No stages found. Seeding default job stages...';
        
        -- Insert the 12 standard stages
        INSERT INTO job_stages (id, name, description, color, sequence_order, maps_to_status, stage_type, min_duration_hours, max_duration_hours, company_id) VALUES
        ('550e8400-e29b-41d4-a716-446655440001', '1/12 Lead Qualification', 'Initial assessment of lead viability and requirements', '#C7D2FE', 1, 'planning', 'standard', 1, 168, NULL),
        ('550e8400-e29b-41d4-a716-446655440002', '2/12 Initial Client Meeting', 'First meeting with client to understand project scope', '#A5B4FC', 2, 'planning', 'milestone', 2, 72, NULL),
        ('550e8400-e29b-41d4-a716-446655440003', '3/12 Quote Preparation', 'Prepare detailed project quote and estimates', '#93C5FD', 3, 'planning', 'standard', 4, 120, NULL),
        ('550e8400-e29b-41d4-a716-446655440004', '4/12 Quote Submission', 'Submit quote to client and await response', '#60A5FA', 4, 'planning', 'milestone', 1, 336, NULL),
        ('550e8400-e29b-41d4-a716-446655440005', '5/12 Client Decision', 'Client reviews and makes decision on quote', '#38BDF8', 5, 'planning', 'approval', 1, 168, NULL),
        ('550e8400-e29b-41d4-a716-446655440006', '6/12 Contract & Deposit', 'Finalize contract terms and collect deposit', '#34D399', 6, 'active', 'milestone', 2, 72, NULL),
        ('550e8400-e29b-41d4-a716-446655440007', '7/12 Planning & Procurement', 'Detailed planning and material procurement', '#4ADE80', 7, 'active', 'standard', 8, 168, NULL),
        ('550e8400-e29b-41d4-a716-446655440008', '8/12 On-Site Preparation', 'Site preparation and setup for construction', '#FACC15', 8, 'active', 'standard', 4, 72, NULL),
        ('550e8400-e29b-41d4-a716-446655440009', '9/12 Construction Execution', 'Main construction and building phase', '#FB923C', 9, 'active', 'standard', 40, 2000, NULL),
        ('550e8400-e29b-41d4-a716-446655440010', '10/12 Inspections & Progress Payments', 'Quality inspections and progress billing', '#F87171', 10, 'active', 'milestone', 2, 48, NULL),
        ('550e8400-e29b-41d4-a716-446655440011', '11/12 Finalisation', 'Final touches and completion preparations', '#F472B6', 11, 'active', 'standard', 8, 120, NULL),
        ('550e8400-e29b-41d4-a716-446655440012', '12/12 Handover & Close', 'Final handover and project closure', '#D1D5DB', 12, 'completed', 'milestone', 1, 24, NULL)
        ON CONFLICT (id) DO NOTHING;

        RAISE NOTICE '✅ Seeded % job stages', ROW_COUNT;
    ELSE
        RAISE NOTICE '✅ Found % existing stages in job_stages table', stage_count;
    END IF;
END $$;

-- Verify the stages were created
SELECT 
    id,
    name,
    sequence_order,
    maps_to_status,
    company_id
FROM job_stages 
ORDER BY sequence_order;

-- Show any jobs that might have invalid current_stage_id references
DO $$
DECLARE
    invalid_jobs INTEGER;
    job_record RECORD;
BEGIN
    SELECT COUNT(*) INTO invalid_jobs
    FROM jobs j
    LEFT JOIN job_stages js ON j.current_stage_id = js.id
    WHERE j.current_stage_id IS NOT NULL AND js.id IS NULL;
    
    IF invalid_jobs > 0 THEN
        RAISE WARNING 'Found % jobs with invalid current_stage_id references:', invalid_jobs;
        
        -- Show the problematic jobs
        RAISE NOTICE 'Jobs with invalid stage references:';
        FOR job_record IN (
            SELECT j.id, j.title, j.current_stage_id
            FROM jobs j
            LEFT JOIN job_stages js ON j.current_stage_id = js.id
            WHERE j.current_stage_id IS NOT NULL AND js.id IS NULL
            LIMIT 10
        )
        LOOP
            RAISE NOTICE 'Job: % (%) - Invalid stage: %', job_record.title, job_record.id, job_record.current_stage_id;
        END LOOP;
        
        -- Offer to fix them
        RAISE NOTICE 'To fix these jobs, you can run:';
        RAISE NOTICE 'UPDATE jobs SET current_stage_id = (SELECT id FROM job_stages ORDER BY sequence_order LIMIT 1) WHERE current_stage_id NOT IN (SELECT id FROM job_stages);';
    ELSE
        RAISE NOTICE '✅ All jobs have valid current_stage_id references';
    END IF;
END $$;

COMMIT;

-- Summary
DO $$
BEGIN
    RAISE NOTICE '🎉 Job stages setup complete!';
    RAISE NOTICE 'You can now create jobs without foreign key constraint violations.';
    RAISE NOTICE 'If you still get errors, check that the job_stages table has been properly seeded.';
END $$;