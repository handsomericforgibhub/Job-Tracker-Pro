-- Update Stage Colors Script
-- Updates all job stage colors to the new color scheme

BEGIN;

-- Update stage colors to match the new color scheme
UPDATE job_stages SET color = '#C7D2FE' WHERE name = 'Lead Qualification';
UPDATE job_stages SET color = '#A5B4FC' WHERE name = 'Initial Client Meeting';
UPDATE job_stages SET color = '#93C5FD' WHERE name = 'Quote Preparation';
UPDATE job_stages SET color = '#60A5FA' WHERE name = 'Quote Submission';
UPDATE job_stages SET color = '#38BDF8' WHERE name = 'Client Decision';
UPDATE job_stages SET color = '#34D399' WHERE name = 'Contract & Deposit';
UPDATE job_stages SET color = '#4ADE80' WHERE name = 'Planning & Procurement';
UPDATE job_stages SET color = '#FACC15' WHERE name = 'On-Site Preparation';
UPDATE job_stages SET color = '#FB923C' WHERE name = 'Construction Execution';
UPDATE job_stages SET color = '#F87171' WHERE name = 'Inspections & Progress Payments';
UPDATE job_stages SET color = '#F472B6' WHERE name = 'Finalisation';
UPDATE job_stages SET color = '#D1D5DB' WHERE name = 'Handover & Close';

-- Verify the updates
SELECT name, color FROM job_stages ORDER BY sequence_order;

COMMIT;