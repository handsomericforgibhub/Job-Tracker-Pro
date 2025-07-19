-- =============================================
-- STAGE COLOR AND NAME UPDATE SCRIPT
-- =============================================
-- Run this script in your Supabase SQL Editor to update stage colors and names

-- Update stage names to include ordering prefix and new colors
UPDATE job_stages SET name = '1/12 Lead Qualification', color = '#C7D2FE' WHERE name = 'Lead Qualification';
UPDATE job_stages SET name = '2/12 Initial Client Meeting', color = '#A5B4FC' WHERE name = 'Initial Client Meeting';
UPDATE job_stages SET name = '3/12 Quote Preparation', color = '#93C5FD' WHERE name = 'Quote Preparation';
UPDATE job_stages SET name = '4/12 Quote Submission', color = '#60A5FA' WHERE name = 'Quote Submission';
UPDATE job_stages SET name = '5/12 Client Decision', color = '#38BDF8' WHERE name = 'Client Decision';
UPDATE job_stages SET name = '6/12 Contract & Deposit', color = '#34D399' WHERE name = 'Contract & Deposit';
UPDATE job_stages SET name = '7/12 Planning & Procurement', color = '#4ADE80' WHERE name = 'Planning & Procurement';
UPDATE job_stages SET name = '8/12 On-Site Preparation', color = '#FACC15' WHERE name = 'On-Site Preparation';
UPDATE job_stages SET name = '9/12 Construction Execution', color = '#FB923C' WHERE name = 'Construction Execution';
UPDATE job_stages SET name = '10/12 Inspections & Progress Payments', color = '#F87171' WHERE name = 'Inspections & Progress Payments';
UPDATE job_stages SET name = '11/12 Finalisation', color = '#F472B6' WHERE name = 'Finalisation';
UPDATE job_stages SET name = '12/12 Handover & Close', color = '#D1D5DB' WHERE name = 'Handover & Close';

-- Verify the updates
SELECT name, color, sequence_order FROM job_stages ORDER BY sequence_order;