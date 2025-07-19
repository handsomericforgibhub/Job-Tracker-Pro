-- Migration script to convert existing standalone jobs to project structure
-- This script creates projects for existing jobs and optionally organizes them

-- Step 1: Ensure all existing jobs are marked as standalone
UPDATE jobs 
SET is_standalone = true 
WHERE project_id IS NULL 
  AND project_stage_id IS NULL 
  AND is_standalone IS NULL;

-- Step 2: Create a function to auto-create projects for jobs if desired
-- This is optional and can be run selectively

CREATE OR REPLACE FUNCTION auto_create_projects_for_jobs()
RETURNS INTEGER AS $$
DECLARE
    job_record RECORD;
    project_id_var UUID;
    stage_id_var UUID;
    created_count INTEGER := 0;
BEGIN
    -- Loop through standalone jobs that could benefit from project structure
    FOR job_record IN
        SELECT DISTINCT 
            j.id as job_id,
            j.title,
            j.description,
            j.client_name,
            j.location,
            j.address_components,
            j.latitude,
            j.longitude,
            j.start_date,
            j.end_date,
            j.budget,
            j.foreman_id,
            j.company_id,
            j.created_by,
            j.created_at
        FROM jobs j
        WHERE j.is_standalone = true
          AND j.project_id IS NULL
          AND j.status IN ('planning', 'active', 'on_hold') -- Only migrate active jobs
          AND j.start_date >= CURRENT_DATE - INTERVAL '6 months' -- Only recent jobs
        ORDER BY j.company_id, j.client_name, j.start_date
    LOOP
        -- Create a project for this job
        INSERT INTO projects (
            name,
            description,
            status,
            client_name,
            site_address,
            address_components,
            latitude,
            longitude,
            planned_start_date,
            planned_end_date,
            total_budget,
            project_manager_id,
            company_id,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            COALESCE(job_record.title, 'Migrated Project'),
            COALESCE(job_record.description, 'Auto-created from existing job'),
            CASE 
                WHEN job_record.start_date <= CURRENT_DATE THEN 'active'
                ELSE 'planning'
            END,
            job_record.client_name,
            job_record.location,
            job_record.address_components,
            job_record.latitude,
            job_record.longitude,
            job_record.start_date::DATE,
            job_record.end_date::DATE,
            job_record.budget,
            job_record.foreman_id,
            job_record.company_id,
            job_record.created_by,
            job_record.created_at,
            NOW()
        ) RETURNING id INTO project_id_var;

        -- Create a default stage for this project
        INSERT INTO project_stages (
            project_id,
            stage_name,
            description,
            sequence_order,
            color,
            status,
            planned_start_date,
            planned_end_date,
            estimated_hours,
            completion_percentage,
            assigned_foreman_id,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            project_id_var,
            'Main Work',
            'Primary work stage for migrated job',
            1,
            '#3b82f6',
            CASE 
                WHEN job_record.start_date <= CURRENT_DATE THEN 'in_progress'
                ELSE 'pending'
            END,
            job_record.start_date::DATE,
            job_record.end_date::DATE,
            EXTRACT(EPOCH FROM (job_record.end_date::TIMESTAMP - job_record.start_date::TIMESTAMP)) / 3600, -- Hours
            CASE 
                WHEN job_record.start_date <= CURRENT_DATE THEN 25 -- Assume 25% progress for active jobs
                ELSE 0
            END,
            job_record.foreman_id,
            job_record.created_by,
            job_record.created_at,
            NOW()
        ) RETURNING id INTO stage_id_var;

        -- Update the job to link to the new project and stage
        UPDATE jobs 
        SET 
            project_id = project_id_var,
            project_stage_id = stage_id_var,
            is_standalone = false,
            updated_at = NOW()
        WHERE id = job_record.job_id;

        created_count := created_count + 1;
        
        -- Log progress every 10 jobs
        IF created_count % 10 = 0 THEN
            RAISE NOTICE 'Migrated % jobs to projects', created_count;
        END IF;
    END LOOP;

    RAISE NOTICE 'Migration completed. Created % projects from existing jobs.', created_count;
    RETURN created_count;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create a function to group jobs by client into projects
-- This creates one project per client and organizes jobs as stages

CREATE OR REPLACE FUNCTION group_jobs_by_client_into_projects()
RETURNS INTEGER AS $$
DECLARE
    client_record RECORD;
    job_record RECORD;
    project_id_var UUID;
    stage_id_var UUID;
    created_projects INTEGER := 0;
    sequence_num INTEGER;
BEGIN
    -- Loop through clients with multiple jobs
    FOR client_record IN
        SELECT 
            company_id,
            client_name,
            COUNT(*) as job_count,
            MIN(start_date) as earliest_start,
            MAX(end_date) as latest_end,
            SUM(budget) as total_budget,
            MIN(created_by) as created_by -- Use first job creator
        FROM jobs 
        WHERE is_standalone = true
          AND project_id IS NULL
          AND client_name IS NOT NULL
          AND client_name != ''
          AND status IN ('planning', 'active', 'on_hold')
          AND start_date >= CURRENT_DATE - INTERVAL '1 year'
        GROUP BY company_id, client_name
        HAVING COUNT(*) > 1 -- Only clients with multiple jobs
        ORDER BY company_id, client_name
    LOOP
        -- Create a project for this client
        INSERT INTO projects (
            name,
            description,
            status,
            client_name,
            planned_start_date,
            planned_end_date,
            total_budget,
            company_id,
            created_by,
            created_at,
            updated_at
        ) VALUES (
            client_record.client_name || ' - Multi-Job Project',
            'Auto-created project grouping multiple jobs for ' || client_record.client_name,
            'active',
            client_record.client_name,
            client_record.earliest_start::DATE,
            client_record.latest_end::DATE,
            client_record.total_budget,
            client_record.company_id,
            client_record.created_by,
            NOW(),
            NOW()
        ) RETURNING id INTO project_id_var;

        -- Create stages for each job under this client
        sequence_num := 1;
        FOR job_record IN
            SELECT *
            FROM jobs 
            WHERE company_id = client_record.company_id
              AND client_name = client_record.client_name
              AND is_standalone = true
              AND project_id IS NULL
            ORDER BY start_date
        LOOP
            -- Create a stage for this job
            INSERT INTO project_stages (
                project_id,
                stage_name,
                description,
                sequence_order,
                color,
                status,
                planned_start_date,
                planned_end_date,
                estimated_hours,
                completion_percentage,
                assigned_foreman_id,
                created_by,
                created_at,
                updated_at
            ) VALUES (
                project_id_var,
                job_record.title,
                job_record.description,
                sequence_num,
                CASE sequence_num % 5
                    WHEN 0 THEN '#ef4444'
                    WHEN 1 THEN '#3b82f6'
                    WHEN 2 THEN '#10b981'
                    WHEN 3 THEN '#f59e0b'
                    WHEN 4 THEN '#8b5cf6'
                END,
                CASE 
                    WHEN job_record.start_date <= CURRENT_DATE THEN 'in_progress'
                    ELSE 'pending'
                END,
                job_record.start_date::DATE,
                job_record.end_date::DATE,
                EXTRACT(EPOCH FROM (job_record.end_date::TIMESTAMP - job_record.start_date::TIMESTAMP)) / 3600,
                CASE 
                    WHEN job_record.start_date <= CURRENT_DATE THEN 25
                    ELSE 0
                END,
                job_record.foreman_id,
                job_record.created_by,
                NOW(),
                NOW()
            ) RETURNING id INTO stage_id_var;

            -- Update the job to link to the new project and stage
            UPDATE jobs 
            SET 
                project_id = project_id_var,
                project_stage_id = stage_id_var,
                is_standalone = false,
                updated_at = NOW()
            WHERE id = job_record.id;

            sequence_num := sequence_num + 1;
        END LOOP;

        created_projects := created_projects + 1;
        RAISE NOTICE 'Created project for client: % (% jobs)', client_record.client_name, client_record.job_count;
    END LOOP;

    RAISE NOTICE 'Client grouping completed. Created % projects.', created_projects;
    RETURN created_projects;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create a rollback function in case migration needs to be reversed
CREATE OR REPLACE FUNCTION rollback_job_to_project_migration()
RETURNS INTEGER AS $$
DECLARE
    rollback_count INTEGER := 0;
BEGIN
    -- Count jobs that will be rolled back
    SELECT COUNT(*) INTO rollback_count
    FROM jobs 
    WHERE project_id IS NOT NULL 
      AND project_stage_id IS NOT NULL 
      AND is_standalone = false;

    -- Reset jobs to standalone
    UPDATE jobs 
    SET 
        project_id = NULL,
        project_stage_id = NULL,
        is_standalone = true,
        updated_at = NOW()
    WHERE project_id IS NOT NULL 
      AND project_stage_id IS NOT NULL 
      AND is_standalone = false;

    -- Note: This doesn't delete the projects/stages as they might have been manually created
    -- To fully clean up, run: DELETE FROM projects WHERE created_at > [migration_date];

    RAISE NOTICE 'Rollback completed. Reset % jobs to standalone.', rollback_count;
    RETURN rollback_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_create_projects_for_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION group_jobs_by_client_into_projects() TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_job_to_project_migration() TO authenticated;

-- Usage instructions (commented out - run manually as needed):

-- Option 1: Auto-create individual projects for each job
-- SELECT auto_create_projects_for_jobs();

-- Option 2: Group jobs by client into shared projects  
-- SELECT group_jobs_by_client_into_projects();

-- Option 3: Rollback migration if needed
-- SELECT rollback_job_to_project_migration();

-- Check migration status:
-- SELECT 
--   COUNT(*) as total_jobs,
--   SUM(CASE WHEN is_standalone THEN 1 ELSE 0 END) as standalone_jobs,
--   SUM(CASE WHEN project_id IS NOT NULL THEN 1 ELSE 0 END) as project_jobs
-- FROM jobs;

COMMENT ON FUNCTION auto_create_projects_for_jobs() IS 'Creates individual projects for each standalone job';
COMMENT ON FUNCTION group_jobs_by_client_into_projects() IS 'Groups multiple jobs per client into shared projects with job-based stages';
COMMENT ON FUNCTION rollback_job_to_project_migration() IS 'Reverses the migration, making all jobs standalone again';