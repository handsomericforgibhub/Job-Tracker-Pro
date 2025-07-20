-- Update Stage Colors Script - Centralized Configuration (Fixed)
-- Updates all job stage colors to use the centralized color scheme from /src/config/colors.ts
-- This script only updates tables that actually exist in the database

BEGIN;

-- Update stage colors to match the centralized THEME_COLORS.STAGES configuration
-- Stage colors from src/config/colors.ts

-- 1/12 Lead Qualification
UPDATE job_stages SET color = '#EF4444' WHERE name LIKE '%Lead Qualification%';

-- 2/12 Initial Client Meeting  
UPDATE job_stages SET color = '#F97316' WHERE name LIKE '%Initial Client Meeting%';

-- 3/12 Site Assessment & Quote
UPDATE job_stages SET color = '#EAB308' WHERE name LIKE '%Site Assessment%' OR name LIKE '%Quote Preparation%';

-- 4/12 Quote Submission
UPDATE job_stages SET color = '#84CC16' WHERE name LIKE '%Quote Submission%';

-- 5/12 Client Decision
UPDATE job_stages SET color = '#22C55E' WHERE name LIKE '%Client Decision%';

-- 6/12 Contract & Deposit
UPDATE job_stages SET color = '#06B6D4' WHERE name LIKE '%Contract%' AND name LIKE '%Deposit%';

-- 7/12 Material Ordering
UPDATE job_stages SET color = '#3B82F6' WHERE name LIKE '%Material Ordering%' OR name LIKE '%Planning%' AND name LIKE '%Procurement%';

-- 8/12 Material Delivery
UPDATE job_stages SET color = '#6366F1' WHERE name LIKE '%Material Delivery%' OR name LIKE '%On-Site Preparation%';

-- 9/12 Construction Start
UPDATE job_stages SET color = '#8B5CF6' WHERE name LIKE '%Construction%' AND (name LIKE '%Start%' OR name LIKE '%Execution%');

-- 10/12 Quality & Inspections
UPDATE job_stages SET color = '#EC4899' WHERE name LIKE '%Inspection%' OR name LIKE '%Quality%' OR name LIKE '%Progress Payment%';

-- 11/12 Client Walkthrough
UPDATE job_stages SET color = '#F59E0B' WHERE name LIKE '%Walkthrough%' OR name LIKE '%Finalisation%';

-- 12/12 Handover & Close
UPDATE job_stages SET color = '#10B981' WHERE name LIKE '%Handover%' OR name LIKE '%Close%';

-- Update platform_settings for job status colors stored in JSON
-- These colors are stored in the default_job_stages setting as JSON
UPDATE platform_settings 
SET setting_value = '[
    {
        "key": "planning",
        "label": "Planning", 
        "color": "#6B7280",
        "description": "Job is in planning phase",
        "is_initial": true,
        "is_final": false,
        "allowed_transitions": ["active", "cancelled"]
    },
    {
        "key": "active",
        "label": "Active",
        "color": "#3B82F6", 
        "description": "Job is actively in progress",
        "is_initial": false,
        "is_final": false,
        "allowed_transitions": ["on_hold", "completed", "cancelled"]
    },
    {
        "key": "on_hold",
        "label": "On Hold",
        "color": "#F59E0B",
        "description": "Job is temporarily paused", 
        "is_initial": false,
        "is_final": false,
        "allowed_transitions": ["active", "cancelled"]
    },
    {
        "key": "completed",
        "label": "Completed",
        "color": "#10B981",
        "description": "Job has been completed successfully",
        "is_initial": false,
        "is_final": true,
        "allowed_transitions": []
    },
    {
        "key": "cancelled", 
        "label": "Cancelled",
        "color": "#EF4444",
        "description": "Job has been cancelled",
        "is_initial": false,
        "is_final": true,
        "allowed_transitions": []
    }
]'
WHERE setting_key = 'default_job_stages';

-- Update priority colors if they exist in platform_settings
UPDATE platform_settings 
SET setting_value = '[
    {
        "key": "low",
        "label": "Low",
        "color": "#6B7280",
        "value": 1
    },
    {
        "key": "medium", 
        "label": "Medium",
        "color": "#F59E0B",
        "value": 2
    },
    {
        "key": "high",
        "label": "High", 
        "color": "#EF4444",
        "value": 3
    },
    {
        "key": "urgent",
        "label": "Urgent",
        "color": "#DC2626", 
        "value": 4
    }
]'
WHERE setting_key = 'task_priorities';

-- Verify the updates
SELECT 'Job Stages:' as section, name, color, sequence_order FROM job_stages ORDER BY sequence_order;

-- Show platform settings that contain color configurations
SELECT 'Platform Settings:' as section, setting_key, setting_value 
FROM platform_settings 
WHERE setting_key IN ('default_job_stages', 'task_priorities')
ORDER BY setting_key;

COMMIT;

-- Notes for developers:
-- These color values correspond to the constants defined in src/config/colors.ts
-- THEME_COLORS.STAGES:
--   LEAD_QUALIFICATION: '#EF4444'        // Red
--   INITIAL_CLIENT_MEETING: '#F97316'    // Orange  
--   SITE_ASSESSMENT: '#EAB308'           // Yellow
--   QUOTE_SUBMISSION: '#84CC16'          // Lime
--   CLIENT_DECISION: '#22C55E'           // Green
--   CONTRACT_DEPOSIT: '#06B6D4'          // Cyan
--   MATERIAL_ORDERING: '#3B82F6'         // Blue
--   MATERIAL_DELIVERY: '#6366F1'         // Indigo
--   CONSTRUCTION_START: '#8B5CF6'        // Purple
--   QUALITY_INSPECTIONS: '#EC4899'       // Pink
--   CLIENT_WALKTHROUGH: '#F59E0B'        // Amber
--   HANDOVER_CLOSE: '#10B981'            // Emerald
--
-- THEME_COLORS.STATUS:
--   TODO/PLANNING: '#6B7280'             // Gray
--   IN_PROGRESS/ACTIVE: '#3B82F6'        // Blue
--   COMPLETED: '#10B981'                 // Emerald
--   BLOCKED: '#EF4444'                   // Red
--   ON_HOLD: '#F59E0B'                   // Amber
--   CANCELLED: '#DC2626'                 // Dark Red