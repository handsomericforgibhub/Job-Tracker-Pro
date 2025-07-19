-- Time Tracking System Database Schema (Phase 7)
-- JobTracker Pro - Comprehensive time tracking and check-in system
-- Run this in Supabase SQL Editor

-- Step 1: Enhance existing worker_check_ins table with break tracking
DO $$
BEGIN
    -- Add break tracking fields if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_check_ins' AND column_name = 'break_duration'
    ) THEN
        ALTER TABLE worker_check_ins ADD COLUMN break_duration INTEGER DEFAULT 0; -- minutes
        RAISE NOTICE '✅ Added break_duration column to worker_check_ins';
    ELSE
        RAISE NOTICE 'ℹ️ break_duration column already exists in worker_check_ins';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_check_ins' AND column_name = 'notes'
    ) THEN
        ALTER TABLE worker_check_ins ADD COLUMN notes TEXT;
        RAISE NOTICE '✅ Added notes column to worker_check_ins';
    ELSE
        RAISE NOTICE 'ℹ️ notes column already exists in worker_check_ins';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_check_ins' AND column_name = 'gps_accuracy'
    ) THEN
        ALTER TABLE worker_check_ins ADD COLUMN gps_accuracy DECIMAL(8,2); -- meters
        RAISE NOTICE '✅ Added gps_accuracy column to worker_check_ins';
    ELSE
        RAISE NOTICE 'ℹ️ gps_accuracy column already exists in worker_check_ins';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_check_ins' AND column_name = 'is_approved'
    ) THEN
        ALTER TABLE worker_check_ins ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;
        RAISE NOTICE '✅ Added is_approved column to worker_check_ins';
    ELSE
        RAISE NOTICE 'ℹ️ is_approved column already exists in worker_check_ins';
    END IF;
END $$;

-- Step 2: Create detailed time entries table for task-level tracking
CREATE TABLE IF NOT EXISTS time_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- References
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    check_in_id UUID REFERENCES worker_check_ins(id) ON DELETE SET NULL,
    
    -- Time tracking
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER, -- calculated field
    break_duration_minutes INTEGER DEFAULT 0,
    
    -- Entry details
    description TEXT,
    entry_type VARCHAR(20) DEFAULT 'regular' CHECK (entry_type IN ('regular', 'overtime', 'break', 'travel')),
    
    -- Location tracking
    start_location TEXT,
    end_location TEXT,
    start_gps_lat DECIMAL(10, 8),
    start_gps_lng DECIMAL(11, 8),
    end_gps_lat DECIMAL(10, 8),
    end_gps_lng DECIMAL(11, 8),
    
    -- Approval workflow
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    
    -- Labor cost tracking
    hourly_rate DECIMAL(8,2), -- snapshot of worker rate at time of entry
    overtime_rate DECIMAL(8,2), -- calculated overtime rate
    total_cost DECIMAL(10,2), -- calculated total cost
    
    -- Audit fields
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create break entries table for detailed break tracking
CREATE TABLE IF NOT EXISTS break_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- References
    time_entry_id UUID REFERENCES time_entries(id) ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    
    -- Break details
    break_type VARCHAR(20) DEFAULT 'general' CHECK (break_type IN ('lunch', 'general', 'smoke', 'personal', 'rest')),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER, -- calculated field
    
    -- Break tracking
    is_paid BOOLEAN DEFAULT FALSE,
    notes TEXT,
    
    -- Location (for compliance)
    location TEXT,
    gps_lat DECIMAL(10, 8),
    gps_lng DECIMAL(11, 8),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create time approval workflows table
CREATE TABLE IF NOT EXISTS time_approvals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- References
    time_entry_id UUID REFERENCES time_entries(id) ON DELETE CASCADE NOT NULL,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    
    -- Approval details
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'changes_requested')),
    approval_date TIMESTAMP WITH TIME ZONE,
    
    -- Feedback
    approver_notes TEXT,
    requested_changes TEXT,
    worker_response TEXT,
    
    -- Original vs approved values (for edits)
    original_start_time TIMESTAMP WITH TIME ZONE,
    original_end_time TIMESTAMP WITH TIME ZONE,
    approved_start_time TIMESTAMP WITH TIME ZONE,
    approved_end_time TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create overtime rules table for company-specific calculations
CREATE TABLE IF NOT EXISTS overtime_rules (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Company reference
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    
    -- Rule details
    rule_name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Daily overtime
    daily_overtime_threshold DECIMAL(4,2) DEFAULT 8.0, -- hours
    daily_overtime_multiplier DECIMAL(3,2) DEFAULT 1.5,
    
    -- Weekly overtime
    weekly_overtime_threshold DECIMAL(4,2) DEFAULT 40.0, -- hours
    weekly_overtime_multiplier DECIMAL(3,2) DEFAULT 1.5,
    
    -- Double time rules
    double_time_threshold DECIMAL(4,2), -- hours (e.g., 12 hours in a day)
    double_time_multiplier DECIMAL(3,2) DEFAULT 2.0,
    
    -- Weekend/holiday rules
    weekend_multiplier DECIMAL(3,2) DEFAULT 1.0,
    holiday_multiplier DECIMAL(3,2) DEFAULT 2.0,
    
    -- Rule activation
    is_active BOOLEAN DEFAULT TRUE,
    effective_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(company_id, rule_name)
);

-- Step 6: Create time summaries table for reporting performance
CREATE TABLE IF NOT EXISTS time_summaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- References
    worker_id UUID REFERENCES workers(id) ON DELETE CASCADE NOT NULL,
    job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    
    -- Time period
    period_type VARCHAR(10) CHECK (period_type IN ('daily', 'weekly', 'monthly')),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Time totals (in minutes)
    regular_minutes INTEGER DEFAULT 0,
    overtime_minutes INTEGER DEFAULT 0,
    break_minutes INTEGER DEFAULT 0,
    total_minutes INTEGER DEFAULT 0,
    
    -- Cost totals
    regular_cost DECIMAL(10,2) DEFAULT 0,
    overtime_cost DECIMAL(10,2) DEFAULT 0,
    total_cost DECIMAL(10,2) DEFAULT 0,
    
    -- Status tracking
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    last_calculated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(worker_id, job_id, period_type, period_start)
);

-- Step 7: Add indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_time_entries_worker_id ON time_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_job_id ON time_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_start_time ON time_entries(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON time_entries(status);
CREATE INDEX IF NOT EXISTS idx_time_entries_company_id ON time_entries(company_id);

CREATE INDEX IF NOT EXISTS idx_break_entries_time_entry_id ON break_entries(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_break_entries_worker_id ON break_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_break_entries_start_time ON break_entries(start_time DESC);

CREATE INDEX IF NOT EXISTS idx_time_approvals_time_entry_id ON time_approvals(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_approvals_approver_id ON time_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_time_approvals_status ON time_approvals(approval_status);

CREATE INDEX IF NOT EXISTS idx_time_summaries_worker_period ON time_summaries(worker_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_time_summaries_job_period ON time_summaries(job_id, period_start DESC);

CREATE INDEX IF NOT EXISTS idx_worker_check_ins_worker_job ON worker_check_ins(worker_id, job_id);
CREATE INDEX IF NOT EXISTS idx_worker_check_ins_check_in_time ON worker_check_ins(check_in_time DESC);

-- Step 8: Create helper functions for time calculations
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration when end_time is set
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    END IF;
    
    -- Calculate total cost if hourly rate is available
    IF NEW.duration_minutes IS NOT NULL AND NEW.hourly_rate IS NOT NULL THEN
        NEW.total_cost := (NEW.duration_minutes / 60.0) * NEW.hourly_rate;
        
        -- Add overtime cost if applicable
        IF NEW.overtime_rate IS NOT NULL AND NEW.entry_type = 'overtime' THEN
            NEW.total_cost := (NEW.duration_minutes / 60.0) * NEW.overtime_rate;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_break_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate break duration when end_time is set
    IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
        NEW.duration_minutes := EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 60;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 9: Create triggers for automatic calculations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_calculate_time_entry_duration'
    ) THEN
        CREATE TRIGGER trigger_calculate_time_entry_duration
            BEFORE INSERT OR UPDATE ON time_entries
            FOR EACH ROW
            EXECUTE FUNCTION calculate_time_entry_duration();
        RAISE NOTICE '✅ Created time entry duration calculation trigger';
    ELSE
        RAISE NOTICE 'ℹ️ Time entry duration trigger already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trigger_calculate_break_duration'
    ) THEN
        CREATE TRIGGER trigger_calculate_break_duration
            BEFORE INSERT OR UPDATE ON break_entries
            FOR EACH ROW
            EXECUTE FUNCTION calculate_break_duration();
        RAISE NOTICE '✅ Created break duration calculation trigger';
    ELSE
        RAISE NOTICE 'ℹ️ Break duration trigger already exists';
    END IF;
END $$;

-- Step 10: Add updated_at triggers for new tables
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_time_entries_updated_at'
    ) THEN
        CREATE TRIGGER update_time_entries_updated_at 
            BEFORE UPDATE ON time_entries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for time_entries';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger for time_entries already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_break_entries_updated_at'
    ) THEN
        CREATE TRIGGER update_break_entries_updated_at 
            BEFORE UPDATE ON break_entries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for break_entries';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger for break_entries already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_time_approvals_updated_at'
    ) THEN
        CREATE TRIGGER update_time_approvals_updated_at 
            BEFORE UPDATE ON time_approvals
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for time_approvals';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger for time_approvals already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_overtime_rules_updated_at'
    ) THEN
        CREATE TRIGGER update_overtime_rules_updated_at 
            BEFORE UPDATE ON overtime_rules
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for overtime_rules';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger for overtime_rules already exists';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_time_summaries_updated_at'
    ) THEN
        CREATE TRIGGER update_time_summaries_updated_at 
            BEFORE UPDATE ON time_summaries
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        RAISE NOTICE '✅ Created trigger for time_summaries';
    ELSE
        RAISE NOTICE 'ℹ️ Trigger for time_summaries already exists';
    END IF;
END $$;

-- Step 11: Insert default overtime rules for existing companies
DO $$
DECLARE
    company_record RECORD;
    rule_count INTEGER;
BEGIN
    FOR company_record IN SELECT id FROM companies LOOP
        -- Check if overtime rules already exist for this company
        SELECT COUNT(*) INTO rule_count 
        FROM overtime_rules 
        WHERE company_id = company_record.id;
        
        IF rule_count = 0 THEN
            INSERT INTO overtime_rules (
                company_id, 
                rule_name, 
                description,
                daily_overtime_threshold,
                daily_overtime_multiplier,
                weekly_overtime_threshold,
                weekly_overtime_multiplier,
                double_time_threshold,
                double_time_multiplier
            ) 
            VALUES (
                company_record.id,
                'Standard Overtime Rules',
                'Default overtime rules: 1.5x after 8 hours daily, 1.5x after 40 hours weekly, 2x after 12 hours daily',
                8.0,  -- 8 hours daily threshold
                1.5,  -- 1.5x multiplier
                40.0, -- 40 hours weekly threshold
                1.5,  -- 1.5x multiplier
                12.0, -- 12 hours double time threshold
                2.0   -- 2x multiplier
            );
            
            RAISE NOTICE '✅ Default overtime rules added for company: %', company_record.id;
        ELSE
            RAISE NOTICE 'ℹ️ Overtime rules already exist for company: % (% rules)', company_record.id, rule_count;
        END IF;
    END LOOP;
END $$;

-- Step 12: Final verification and setup complete message
DO $$
DECLARE
    time_entries_exists BOOLEAN;
    break_entries_exists BOOLEAN;
    time_approvals_exists BOOLEAN;
    overtime_rules_exists BOOLEAN;
    time_summaries_exists BOOLEAN;
    enhanced_check_ins BOOLEAN;
    default_rules_count INTEGER;
BEGIN
    -- Check table creation
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_entries') 
    INTO time_entries_exists;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'break_entries') 
    INTO break_entries_exists;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_approvals') 
    INTO time_approvals_exists;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'overtime_rules') 
    INTO overtime_rules_exists;
    
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'time_summaries') 
    INTO time_summaries_exists;
    
    -- Check enhanced worker_check_ins
    SELECT (
        SELECT COUNT(*) FROM information_schema.columns 
        WHERE table_name = 'worker_check_ins' 
        AND column_name IN ('break_duration', 'notes', 'gps_accuracy', 'is_approved')
    ) = 4 INTO enhanced_check_ins;
    
    -- Check default rules
    SELECT COUNT(*) FROM overtime_rules 
    INTO default_rules_count;

    -- Report results
    IF time_entries_exists THEN
        RAISE NOTICE '✅ Time entries table created with duration and cost calculations';
    ELSE
        RAISE EXCEPTION '❌ Time entries table creation failed';
    END IF;

    IF break_entries_exists THEN
        RAISE NOTICE '✅ Break entries table created with detailed tracking';
    ELSE
        RAISE EXCEPTION '❌ Break entries table creation failed';
    END IF;

    IF time_approvals_exists THEN
        RAISE NOTICE '✅ Time approvals table created with workflow support';
    ELSE
        RAISE EXCEPTION '❌ Time approvals table creation failed';
    END IF;

    IF overtime_rules_exists THEN
        RAISE NOTICE '✅ Overtime rules table created with calculation logic';
    ELSE
        RAISE EXCEPTION '❌ Overtime rules table creation failed';
    END IF;

    IF time_summaries_exists THEN
        RAISE NOTICE '✅ Time summaries table created for reporting performance';
    ELSE
        RAISE EXCEPTION '❌ Time summaries table creation failed';
    END IF;

    IF enhanced_check_ins THEN
        RAISE NOTICE '✅ Worker check-ins table enhanced with additional fields';
    ELSE
        RAISE NOTICE '⚠️ Some enhancements to worker_check_ins may be missing';
    END IF;

    IF default_rules_count > 0 THEN
        RAISE NOTICE '✅ Default overtime rules created (% companies)', default_rules_count;
    ELSE
        RAISE NOTICE '⚠️ No default overtime rules found';
    END IF;

    RAISE NOTICE '';
    RAISE NOTICE '🎉 Time Tracking System database schema setup complete!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Features ready:';
    RAISE NOTICE '   ✅ Enhanced worker check-ins with break tracking';
    RAISE NOTICE '   ✅ Detailed time entries with task-level tracking';
    RAISE NOTICE '   ✅ Break time management and tracking';
    RAISE NOTICE '   ✅ Time approval workflows for managers';
    RAISE NOTICE '   ✅ Overtime rules and calculations';
    RAISE NOTICE '   ✅ Time summaries for reporting performance';
    RAISE NOTICE '   ✅ GPS location tracking capabilities';
    RAISE NOTICE '   ✅ Labor cost calculations with rates';
    RAISE NOTICE '   ✅ Automatic duration and cost calculations';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Time tracking system is ready for API and UI development!';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Next steps:';
    RAISE NOTICE '   1. Create TypeScript interfaces for new entities';
    RAISE NOTICE '   2. Build API endpoints for time tracking operations';
    RAISE NOTICE '   3. Develop UI components for check-in/out and time entry';
    RAISE NOTICE '   4. Implement manager approval workflows';
    RAISE NOTICE '   5. Add time tracking to worker and manager dashboards';
END $$;