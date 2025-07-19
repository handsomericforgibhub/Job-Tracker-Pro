-- Seed Initial Stages Data
-- Insert the 12 stages from the spec with questions and transitions

BEGIN;

-- =============================================
-- 1. INSERT THE 12 STAGES FROM SPEC
-- =============================================

-- Insert job stages with proper sequence and status mapping
INSERT INTO job_stages (id, name, description, color, sequence_order, maps_to_status, stage_type, min_duration_hours, max_duration_hours) VALUES
('550e8400-e29b-41d4-a716-446655440001', '1/12 Lead Qualification', 'Initial assessment of lead viability and requirements', '#C7D2FE', 1, 'planning', 'standard', 1, 168),
('550e8400-e29b-41d4-a716-446655440002', '2/12 Initial Client Meeting', 'First meeting with client to understand project scope', '#A5B4FC', 2, 'planning', 'milestone', 2, 72),
('550e8400-e29b-41d4-a716-446655440003', '3/12 Quote Preparation', 'Prepare detailed project quote and estimates', '#93C5FD', 3, 'planning', 'standard', 4, 120),
('550e8400-e29b-41d4-a716-446655440004', '4/12 Quote Submission', 'Submit quote to client and await response', '#60A5FA', 4, 'planning', 'milestone', 1, 336),
('550e8400-e29b-41d4-a716-446655440005', '5/12 Client Decision', 'Client reviews and makes decision on quote', '#38BDF8', 5, 'planning', 'approval', 1, 168),
('550e8400-e29b-41d4-a716-446655440006', '6/12 Contract & Deposit', 'Finalize contract terms and collect deposit', '#34D399', 6, 'active', 'milestone', 2, 72),
('550e8400-e29b-41d4-a716-446655440007', '7/12 Planning & Procurement', 'Detailed planning and material procurement', '#4ADE80', 7, 'active', 'standard', 8, 168),
('550e8400-e29b-41d4-a716-446655440008', '8/12 On-Site Preparation', 'Site preparation and setup for construction', '#FACC15', 8, 'active', 'standard', 4, 72),
('550e8400-e29b-41d4-a716-446655440009', '9/12 Construction Execution', 'Main construction and building phase', '#FB923C', 9, 'active', 'standard', 40, 2000),
('550e8400-e29b-41d4-a716-446655440010', '10/12 Inspections & Progress Payments', 'Quality inspections and progress billing', '#F87171', 10, 'active', 'milestone', 2, 48),
('550e8400-e29b-41d4-a716-446655440011', '11/12 Finalisation', 'Final touches and completion preparations', '#F472B6', 11, 'active', 'standard', 8, 120),
('550e8400-e29b-41d4-a716-446655440012', '12/12 Handover & Close', 'Final handover and project closure', '#D1D5DB', 12, 'completed', 'milestone', 1, 24);

-- =============================================
-- 2. INSERT STAGE QUESTIONS
-- =============================================

-- Lead Qualification Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'Have you qualified this lead as a viable opportunity?', 'yes_no', 1, 'Consider budget, timeline, and project scope', '{}'),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'What is the estimated project value?', 'number', 2, 'Enter rough estimate in dollars', '{}'),
('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'When does the client want to start?', 'date', 3, 'Ideal project start date', '{}');

-- Initial Client Meeting Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440002', 'Have you had your initial meeting with the client?', 'yes_no', 1, 'Face-to-face or video meeting to discuss project', '{}'),
('650e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 'When is the site meeting scheduled?', 'date', 2, 'Schedule on-site assessment', '{"previous_responses": [{"question_id": "650e8400-e29b-41d4-a716-446655440004", "response_value": "Yes"}]}'),
('650e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440002', 'Upload meeting notes or photos', 'file_upload', 3, 'Document important details from the meeting', '{}');

-- Quote Preparation Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440003', 'Have you completed the site assessment?', 'yes_no', 1, 'Detailed on-site evaluation for accurate quoting', '{}'),
('650e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440003', 'Are all materials and labor costs calculated?', 'yes_no', 2, 'Ensure comprehensive cost breakdown', '{}'),
('650e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440003', 'What is the total quote amount?', 'number', 3, 'Final quote amount including all costs and margin', '{}');

-- Quote Submission Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440004', 'Has the quote been submitted to the client?', 'yes_no', 1, 'Quote formally sent via email or hand-delivered', '{}'),
('650e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440004', 'When do you expect a response?', 'date', 2, 'Client indicated decision timeline', '{}'),
('650e8400-e29b-41d4-a716-446655440012', '550e8400-e29b-41d4-a716-446655440004', 'Upload quote document', 'file_upload', 3, 'Keep copy of submitted quote', '{}');

-- Client Decision Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440013', '550e8400-e29b-41d4-a716-446655440005', 'Has the client accepted the quote?', 'yes_no', 1, 'Client formally agreed to proceed', '{}'),
('650e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440005', 'Are there any requested changes?', 'text', 2, 'Document any scope or price modifications', '{"previous_responses": [{"question_id": "650e8400-e29b-41d4-a716-446655440013", "response_value": "Yes"}]}'),
('650e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440005', 'What is the reason for rejection?', 'text', 3, 'Understand why quote was declined', '{"previous_responses": [{"question_id": "650e8400-e29b-41d4-a716-446655440013", "response_value": "No"}]}');

-- Contract & Deposit Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440016', '550e8400-e29b-41d4-a716-446655440006', 'Has the contract been signed?', 'yes_no', 1, 'Both parties have signed the agreement', '{}'),
('650e8400-e29b-41d4-a716-446655440017', '550e8400-e29b-41d4-a716-446655440006', 'Has the deposit been received?', 'yes_no', 2, 'Initial payment collected as per contract', '{}'),
('650e8400-e29b-41d4-a716-446655440018', '550e8400-e29b-41d4-a716-446655440006', 'Upload signed contract', 'file_upload', 3, 'Store signed contract documents', '{}');

-- Planning & Procurement Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440019', '550e8400-e29b-41d4-a716-446655440007', 'Have you ordered materials yet?', 'yes_no', 1, 'Materials ordered and delivery scheduled', '{}'),
('650e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440007', 'When will materials be delivered?', 'date', 2, 'Expected delivery date for materials', '{}'),
('650e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440007', 'Is the work schedule finalized?', 'yes_no', 3, 'Team schedule and project timeline confirmed', '{}');

-- On-Site Preparation Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440008', 'Is the site prepared for construction?', 'yes_no', 1, 'Site cleared and ready for work to begin', '{}'),
('650e8400-e29b-41d4-a716-446655440023', '550e8400-e29b-41d4-a716-446655440008', 'Are all permits obtained?', 'yes_no', 2, 'All required building permits and approvals', '{}'),
('650e8400-e29b-41d4-a716-446655440024', '550e8400-e29b-41d4-a716-446655440008', 'When will construction begin?', 'date', 3, 'Actual construction start date', '{}');

-- Construction Execution Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440025', '550e8400-e29b-41d4-a716-446655440009', 'Are there any variations so far?', 'yes_no', 1, 'Changes to original scope during construction', '{}'),
('650e8400-e29b-41d4-a716-446655440026', '550e8400-e29b-41d4-a716-446655440009', 'What is the current completion percentage?', 'number', 2, 'Estimated percentage of work completed', '{}'),
('650e8400-e29b-41d4-a716-446655440027', '550e8400-e29b-41d4-a716-446655440009', 'Upload progress photos', 'file_upload', 3, 'Document construction progress', '{}');

-- Inspections & Progress Payments Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440028', '550e8400-e29b-41d4-a716-446655440010', 'Have inspections been passed?', 'yes_no', 1, 'All required inspections completed successfully', '{}'),
('650e8400-e29b-41d4-a716-446655440029', '550e8400-e29b-41d4-a716-446655440010', 'Has progress payment been requested?', 'yes_no', 2, 'Invoice sent for completed work', '{}'),
('650e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440010', 'Upload inspection certificates', 'file_upload', 3, 'Store inspection approval documents', '{}');

-- Finalisation Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440011', 'Are all finishing touches complete?', 'yes_no', 1, 'Final details and cleanup completed', '{}'),
('650e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440011', 'Is the final invoice prepared?', 'yes_no', 2, 'Final billing ready for client', '{}'),
('650e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440011', 'When is handover scheduled?', 'date', 3, 'Scheduled date for project handover', '{}');

-- Handover & Close Questions
INSERT INTO stage_questions (id, stage_id, question_text, response_type, sequence_order, help_text, skip_conditions) VALUES
('650e8400-e29b-41d4-a716-446655440034', '550e8400-e29b-41d4-a716-446655440012', 'Has the project been handed over to the client?', 'yes_no', 1, 'Client has accepted completed project', '{}'),
('650e8400-e29b-41d4-a716-446655440035', '550e8400-e29b-41d4-a716-446655440012', 'Has final payment been received?', 'yes_no', 2, 'All payments collected from client', '{}'),
('650e8400-e29b-41d4-a716-446655440036', '550e8400-e29b-41d4-a716-446655440012', 'Upload handover documentation', 'file_upload', 3, 'Warranties, manuals, and completion certificates', '{}');

-- =============================================
-- 3. INSERT STAGE TRANSITIONS
-- =============================================

-- Transitions from Lead Qualification
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440001"}', true),
('550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440012', 'No', '{"question_id": "650e8400-e29b-41d4-a716-446655440001", "action": "close_as_unqualified"}', false);

-- Transitions from Initial Client Meeting
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440004"}', true);
-- Note: When user answers "No" to meeting question, no transition occurs (stays in current stage)

-- Transitions from Quote Preparation
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440008"}', true);

-- Transitions from Quote Submission
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440010"}', true);

-- Transitions from Client Decision
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440006', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440013"}', true),
('550e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440003', 'No', '{"question_id": "650e8400-e29b-41d4-a716-446655440013", "action": "revise_quote"}', false);

-- Transitions from Contract & Deposit
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440007', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440017"}', true);

-- Transitions from Planning & Procurement
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440008', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440021"}', true);

-- Transitions from On-Site Preparation
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440009', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440023"}', true);

-- Transitions from Construction Execution
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440009', '550e8400-e29b-41d4-a716-446655440010', '90', '{"question_id": "650e8400-e29b-41d4-a716-446655440026", "condition": ">=90"}', true);
-- Note: When completion percentage is <90%, no transition occurs (stays in construction stage)

-- Transitions from Inspections & Progress Payments
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440011', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440028"}', true);

-- Transitions from Finalisation
INSERT INTO stage_transitions (from_stage_id, to_stage_id, trigger_response, conditions, is_automatic) VALUES
('550e8400-e29b-41d4-a716-446655440011', '550e8400-e29b-41d4-a716-446655440012', 'Yes', '{"question_id": "650e8400-e29b-41d4-a716-446655440032"}', true);

-- =============================================
-- 4. INSERT TASK TEMPLATES
-- =============================================

-- Lead Qualification Tasks
INSERT INTO task_templates (stage_id, task_type, title, description, subtasks, priority, auto_assign_to, client_visible) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'checklist', 'Lead Qualification Checklist', 'Complete initial lead assessment', 
'[{"id": "1", "title": "Review lead source and details", "completed": false}, {"id": "2", "title": "Assess project budget range", "completed": false}, {"id": "3", "title": "Evaluate timeline feasibility", "completed": false}, {"id": "4", "title": "Check client references if applicable", "completed": false}]', 
'normal', 'creator', false);

-- Initial Client Meeting Tasks
INSERT INTO task_templates (stage_id, task_type, title, description, subtasks, priority, auto_assign_to, client_visible) VALUES
('550e8400-e29b-41d4-a716-446655440002', 'scheduling', 'Schedule Initial Meeting', 'Arrange first meeting with client', 
'[{"id": "1", "title": "Contact client to schedule meeting", "completed": false}, {"id": "2", "title": "Confirm meeting time and location", "completed": false}, {"id": "3", "title": "Prepare meeting agenda", "completed": false}]', 
'high', 'creator', true);

-- Quote Preparation Tasks
INSERT INTO task_templates (stage_id, task_type, title, description, subtasks, priority, auto_assign_to, client_visible, upload_required, upload_file_types) VALUES
('550e8400-e29b-41d4-a716-446655440003', 'documentation', 'Prepare Detailed Quote', 'Create comprehensive project quote', 
'[{"id": "1", "title": "Conduct site survey", "completed": false}, {"id": "2", "title": "Calculate material costs", "completed": false}, {"id": "3", "title": "Estimate labor requirements", "completed": false}, {"id": "4", "title": "Add profit margin", "completed": false}, {"id": "5", "title": "Create quote document", "completed": false}]', 
'high', 'creator', false, true, '{pdf,doc,docx}');

-- Contract & Deposit Tasks
INSERT INTO task_templates (stage_id, task_type, title, description, subtasks, priority, auto_assign_to, client_visible, upload_required, upload_file_types) VALUES
('550e8400-e29b-41d4-a716-446655440006', 'documentation', 'Contract and Deposit Collection', 'Finalize contract and collect deposit', 
'[{"id": "1", "title": "Prepare contract documents", "completed": false}, {"id": "2", "title": "Review terms with client", "completed": false}, {"id": "3", "title": "Collect signed contract", "completed": false}, {"id": "4", "title": "Process deposit payment", "completed": false}]', 
'urgent', 'creator', true, true, '{pdf,jpg,png}');

-- Planning & Procurement Tasks
INSERT INTO task_templates (stage_id, task_type, title, description, subtasks, priority, auto_assign_to, client_visible, sla_hours) VALUES
('550e8400-e29b-41d4-a716-446655440007', 'checklist', 'Planning and Material Procurement', 'Organize project planning and order materials', 
'[{"id": "1", "title": "Create detailed work schedule", "completed": false}, {"id": "2", "title": "Order materials from suppliers", "completed": false}, {"id": "3", "title": "Arrange delivery schedules", "completed": false}, {"id": "4", "title": "Coordinate with team members", "completed": false}]', 
'high', 'foreman', false, 48);

-- Construction Execution Tasks
INSERT INTO task_templates (stage_id, task_type, title, description, subtasks, priority, auto_assign_to, client_visible, upload_required, upload_file_types) VALUES
('550e8400-e29b-41d4-a716-446655440009', 'documentation', 'Progress Documentation', 'Document construction progress', 
'[{"id": "1", "title": "Take daily progress photos", "completed": false}, {"id": "2", "title": "Update completion percentage", "completed": false}, {"id": "3", "title": "Note any issues or delays", "completed": false}, {"id": "4", "title": "Communicate with client", "completed": false}]', 
'normal', 'foreman', true, true, '{jpg,png,pdf}');

-- Handover & Close Tasks
INSERT INTO task_templates (stage_id, task_type, title, description, subtasks, priority, auto_assign_to, client_visible, upload_required, upload_file_types) VALUES
('550e8400-e29b-41d4-a716-446655440012', 'documentation', 'Project Handover Documentation', 'Complete project handover process', 
'[{"id": "1", "title": "Prepare handover documentation", "completed": false}, {"id": "2", "title": "Collect final payment", "completed": false}, {"id": "3", "title": "Provide warranties and manuals", "completed": false}, {"id": "4", "title": "Schedule follow-up check", "completed": false}]', 
'high', 'creator', true, true, '{pdf,doc,docx}');

-- =============================================
-- 5. CREATE INITIAL SYSTEM SETTINGS
-- =============================================

-- Insert default settings for question-driven progression
INSERT INTO platform_settings (setting_key, setting_value, setting_type, description, is_active) VALUES
('question_driven_progression_enabled', 'true', 'feature_toggles', 'Enable question-driven job progression system', true),
('max_stage_duration_hours', '2000', 'system_limits', 'Maximum hours a job can stay in any stage', true),
('auto_create_tasks', 'true', 'feature_toggles', 'Automatically create tasks when stages change', true),
('client_portal_enabled', 'true', 'feature_toggles', 'Enable client portal for external responses', true),
('mobile_optimized_ui', 'true', 'feature_toggles', 'Use mobile-optimized interface', true),
('sla_monitoring_enabled', 'true', 'feature_toggles', 'Enable SLA monitoring and alerts', true);

COMMIT;

-- =============================================
-- 6. VERIFICATION QUERIES
-- =============================================

-- Verify stages were created
SELECT COUNT(*) as stages_created FROM job_stages;

-- Verify questions were created
SELECT COUNT(*) as questions_created FROM stage_questions;

-- Verify transitions were created
SELECT COUNT(*) as transitions_created FROM stage_transitions;

-- Verify task templates were created
SELECT COUNT(*) as task_templates_created FROM task_templates;

-- Show stage progression flow
SELECT 
  js1.name as from_stage,
  js2.name as to_stage,
  st.trigger_response,
  st.is_automatic
FROM stage_transitions st
JOIN job_stages js1 ON st.from_stage_id = js1.id
JOIN job_stages js2 ON st.to_stage_id = js2.id
ORDER BY js1.sequence_order;