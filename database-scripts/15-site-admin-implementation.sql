-- Site Administrator Implementation
-- This script adds the site_admin role and related functionality

-- =============================================
-- STEP 1: UPDATE USER ROLE ENUM
-- =============================================

-- Add site_admin to the existing role constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
CHECK (role IN ('owner', 'foreman', 'worker', 'site_admin'));

-- Make company_id nullable for site_admin users
ALTER TABLE users ALTER COLUMN company_id DROP NOT NULL;

-- =============================================
-- STEP 2: CREATE SITE ADMIN USER
-- =============================================

-- First, check if the user already exists and update them
UPDATE users 
SET 
    role = 'site_admin',
    company_id = NULL,
    full_name = 'Site Administrator',
    updated_at = NOW()
WHERE email = 'handsomeric@hotmail.com';

-- If the user doesn't exist, we'll need to create them manually
-- Note: This assumes the user has already registered through Supabase Auth
-- If they haven't, they'll need to sign up first, then run this update

-- =============================================
-- STEP 3: UPDATE RLS POLICIES FOR SITE ADMIN
-- =============================================

-- Companies table - site admin can see all companies
DROP POLICY IF EXISTS "Users can only view their own company" ON companies;
CREATE POLICY "Users can view companies" ON companies 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            users.company_id = companies.id
        )
    )
);

-- Jobs table - site admin can see all jobs
DROP POLICY IF EXISTS "Users can only view jobs from their company" ON jobs;
CREATE POLICY "Users can view jobs" ON jobs 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            users.company_id = jobs.company_id
        )
    )
);

-- Jobs table - site admin can create jobs for any company
DROP POLICY IF EXISTS "Users can create jobs in their company" ON jobs;
CREATE POLICY "Users can create jobs" ON jobs 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.company_id = jobs.company_id AND users.role IN ('owner', 'foreman'))
        )
    )
);

-- Jobs table - site admin can update any job
DROP POLICY IF EXISTS "Users can update jobs in their company" ON jobs;
CREATE POLICY "Users can update jobs" ON jobs 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.company_id = jobs.company_id AND users.role IN ('owner', 'foreman'))
        )
    )
);

-- Jobs table - site admin can delete any job
DROP POLICY IF EXISTS "Users can delete jobs in their company" ON jobs;
CREATE POLICY "Users can delete jobs" ON jobs 
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.company_id = jobs.company_id AND users.role = 'owner')
        )
    )
);

-- Users table - site admin can view all users
DROP POLICY IF EXISTS "Users can view users in their company" ON users;
CREATE POLICY "Users can view users" ON users 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND (
            u.role = 'site_admin' OR 
            u.company_id = users.company_id
        )
    )
);

-- Users table - site admin can create users for any company
DROP POLICY IF EXISTS "Users can create users in their company" ON users;
CREATE POLICY "Users can create users" ON users 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND (
            u.role = 'site_admin' OR 
            (u.company_id = users.company_id AND u.role IN ('owner', 'foreman'))
        )
    )
);

-- Users table - site admin can update any user
DROP POLICY IF EXISTS "Users can update users in their company" ON users;
CREATE POLICY "Users can update users" ON users 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND (
            u.role = 'site_admin' OR 
            (u.company_id = users.company_id AND u.role IN ('owner', 'foreman'))
        )
    )
);

-- =============================================
-- STEP 4: UPDATE WORKERS TABLE RLS
-- =============================================

-- Update workers table policies if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workers') THEN
        -- Workers table - site admin can see all workers
        DROP POLICY IF EXISTS "Users can view workers in their company" ON workers;
        CREATE POLICY "Users can view workers" ON workers 
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    users.company_id = workers.company_id
                )
            )
        );

        -- Workers table - site admin can manage all workers
        DROP POLICY IF EXISTS "Users can manage workers in their company" ON workers;
        CREATE POLICY "Users can manage workers" ON workers 
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    (users.company_id = workers.company_id AND users.role IN ('owner', 'foreman'))
                )
            )
        );
    END IF;
END $$;

-- =============================================
-- STEP 5: UPDATE TASKS TABLE RLS
-- =============================================

-- Update tasks table policies if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        -- Tasks table - site admin can see all tasks
        DROP POLICY IF EXISTS "Users can view tasks in their company" ON tasks;
        CREATE POLICY "Users can view tasks" ON tasks 
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    users.company_id = (
                        SELECT company_id FROM jobs WHERE jobs.id = tasks.job_id
                    )
                )
            )
        );

        -- Tasks table - site admin can manage all tasks
        DROP POLICY IF EXISTS "Users can manage tasks in their company" ON tasks;
        CREATE POLICY "Users can manage tasks" ON tasks 
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    users.company_id = (
                        SELECT company_id FROM jobs WHERE jobs.id = tasks.job_id
                    )
                )
            )
        );
    END IF;
END $$;

-- =============================================
-- STEP 6: UPDATE DOCUMENTS TABLE RLS
-- =============================================

-- Update documents table policies if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'documents') THEN
        -- Documents table - site admin can see all documents
        DROP POLICY IF EXISTS "Users can view documents in their company" ON documents;
        CREATE POLICY "Users can view documents" ON documents 
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    users.company_id = (
                        SELECT company_id FROM jobs WHERE jobs.id = documents.job_id
                    )
                )
            )
        );

        -- Documents table - site admin can manage all documents
        DROP POLICY IF EXISTS "Users can manage documents in their company" ON documents;
        CREATE POLICY "Users can manage documents" ON documents 
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    users.company_id = (
                        SELECT company_id FROM jobs WHERE jobs.id = documents.job_id
                    )
                )
            )
        );
    END IF;
END $$;

-- =============================================
-- STEP 7: UPDATE TIME TRACKING RLS
-- =============================================

-- Update time_entries table policies if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_entries') THEN
        -- Time entries table - site admin can see all entries
        DROP POLICY IF EXISTS "Users can view time entries in their company" ON time_entries;
        CREATE POLICY "Users can view time entries" ON time_entries 
        FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    users.company_id = time_entries.company_id
                )
            )
        );

        -- Time entries table - site admin can manage all entries
        DROP POLICY IF EXISTS "Users can manage time entries in their company" ON time_entries;
        CREATE POLICY "Users can manage time entries" ON time_entries 
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = auth.uid() 
                AND (
                    users.role = 'site_admin' OR 
                    users.company_id = time_entries.company_id
                )
            )
        );
    END IF;
END $$;

-- =============================================
-- STEP 8: UPDATE ADMIN CONFIGURATION RLS
-- =============================================

-- Platform settings - site admin can manage all
DROP POLICY IF EXISTS "Only owners can view platform settings" ON platform_settings;
CREATE POLICY "Site admin and owners can view platform settings" ON platform_settings 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('site_admin', 'owner')
    )
);

DROP POLICY IF EXISTS "Only owners can modify platform settings" ON platform_settings;
CREATE POLICY "Site admin and owners can modify platform settings" ON platform_settings 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('site_admin', 'owner')
    )
);

-- Company settings - site admin can manage all
DROP POLICY IF EXISTS "Users can view their company settings" ON company_settings;
CREATE POLICY "Users can view company settings" ON company_settings 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.role = 'owner' AND users.company_id = company_settings.company_id)
        )
    )
);

DROP POLICY IF EXISTS "Users can modify their company settings" ON company_settings;
CREATE POLICY "Users can modify company settings" ON company_settings 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
            users.role = 'site_admin' OR 
            (users.role = 'owner' AND users.company_id = company_settings.company_id)
        )
    )
);

-- =============================================
-- STEP 9: CREATE SITE ADMIN HELPER FUNCTIONS
-- =============================================

-- Function to check if current user is site admin
CREATE OR REPLACE FUNCTION is_site_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND users.role = 'site_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all companies for site admin
CREATE OR REPLACE FUNCTION get_all_companies_for_site_admin()
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    user_count BIGINT,
    job_count BIGINT,
    active_job_count BIGINT
) AS $$
BEGIN
    -- Check if user is site admin
    IF NOT is_site_admin() THEN
        RAISE EXCEPTION 'Access denied. Only site admins can view all companies.';
    END IF;

    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.created_at,
        c.updated_at,
        COALESCE(user_counts.user_count, 0) as user_count,
        COALESCE(job_counts.job_count, 0) as job_count,
        COALESCE(job_counts.active_job_count, 0) as active_job_count
    FROM companies c
    LEFT JOIN (
        SELECT 
            company_id,
            COUNT(*) as user_count
        FROM users 
        WHERE company_id IS NOT NULL
        GROUP BY company_id
    ) user_counts ON c.id = user_counts.company_id
    LEFT JOIN (
        SELECT 
            company_id,
            COUNT(*) as job_count,
            COUNT(CASE WHEN status = 'active' THEN 1 END) as active_job_count
        FROM jobs 
        GROUP BY company_id
    ) job_counts ON c.id = job_counts.company_id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get platform statistics for site admin
CREATE OR REPLACE FUNCTION get_platform_statistics()
RETURNS TABLE (
    total_companies BIGINT,
    total_users BIGINT,
    total_jobs BIGINT,
    active_jobs BIGINT,
    total_workers BIGINT,
    recent_signups BIGINT
) AS $$
BEGIN
    -- Check if user is site admin
    IF NOT is_site_admin() THEN
        RAISE EXCEPTION 'Access denied. Only site admins can view platform statistics.';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM companies) as total_companies,
        (SELECT COUNT(*) FROM users WHERE role != 'site_admin') as total_users,
        (SELECT COUNT(*) FROM jobs) as total_jobs,
        (SELECT COUNT(*) FROM jobs WHERE status = 'active') as active_jobs,
        (SELECT COUNT(*) FROM users WHERE role = 'worker') as total_workers,
        (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '7 days' AND role != 'site_admin') as recent_signups;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_site_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_companies_for_site_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_platform_statistics() TO authenticated;

-- =============================================
-- STEP 10: CREATE SITE ADMIN VIEWS
-- =============================================

-- View for site admin to see all users across companies
CREATE OR REPLACE VIEW site_admin_users_view AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    u.role,
    u.company_id,
    u.created_at,
    u.updated_at,
    c.name as company_name
FROM users u
LEFT JOIN companies c ON u.company_id = c.id
WHERE is_site_admin() = true
ORDER BY u.created_at DESC;

-- View for site admin to see all jobs across companies
CREATE OR REPLACE VIEW site_admin_jobs_view AS
SELECT 
    j.id,
    j.title,
    j.description,
    j.status,
    j.start_date,
    j.end_date,
    j.budget,
    j.client_name,
    j.company_id,
    j.created_at,
    j.updated_at,
    c.name as company_name,
    u.full_name as created_by_name
FROM jobs j
LEFT JOIN companies c ON j.company_id = c.id
LEFT JOIN users u ON j.created_by = u.id
WHERE is_site_admin() = true
ORDER BY j.created_at DESC;

-- Grant select permissions on views
GRANT SELECT ON site_admin_users_view TO authenticated;
GRANT SELECT ON site_admin_jobs_view TO authenticated;

-- =============================================
-- FINAL STEP: LOG THE CHANGES
-- =============================================

-- Log the site admin implementation
INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    description,
    new_values,
    created_at
) VALUES (
    (SELECT id FROM users WHERE email = 'handsomeric@hotmail.com'),
    'system_config',
    'Site administrator role implemented and user configured',
    '{"role": "site_admin", "permissions": "cross_company_access", "implementation": "complete"}'::jsonb,
    NOW()
) ON CONFLICT DO NOTHING;

-- Success message
SELECT 'Site administrator role successfully implemented!' as message;