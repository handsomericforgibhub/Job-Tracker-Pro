-- Fix worker_skills table schema
-- Add missing columns that the component expects
-- Run this in Supabase SQL Editor

-- Add missing columns to worker_skills table
ALTER TABLE worker_skills 
ADD COLUMN IF NOT EXISTS skill_category VARCHAR(20) DEFAULT 'specialty' CHECK (skill_category IN ('certification', 'specialty', 'equipment', 'software'));

ALTER TABLE worker_skills 
ADD COLUMN IF NOT EXISTS certification_number VARCHAR(100);

ALTER TABLE worker_skills 
ADD COLUMN IF NOT EXISTS issued_date DATE;

ALTER TABLE worker_skills 
ADD COLUMN IF NOT EXISTS expiry_date DATE;

ALTER TABLE worker_skills 
ADD COLUMN IF NOT EXISTS issuing_authority VARCHAR(255);

ALTER TABLE worker_skills 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE worker_skills 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update existing records to have default skill_category if null
UPDATE worker_skills 
SET skill_category = 'specialty' 
WHERE skill_category IS NULL;

-- Verify the schema is correct
DO $$
BEGIN
    -- Check if all expected columns exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_skills' AND column_name = 'certification_number'
    ) THEN
        RAISE NOTICE '✅ certification_number column added';
    ELSE
        RAISE EXCEPTION '❌ certification_number column missing';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_skills' AND column_name = 'skill_category'
    ) THEN
        RAISE NOTICE '✅ skill_category column added';
    ELSE
        RAISE EXCEPTION '❌ skill_category column missing';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'worker_skills' AND column_name = 'is_verified'
    ) THEN
        RAISE NOTICE '✅ is_verified column added';
    ELSE
        RAISE EXCEPTION '❌ is_verified column missing';
    END IF;

    RAISE NOTICE '🎉 worker_skills table schema updated successfully!';
END $$;