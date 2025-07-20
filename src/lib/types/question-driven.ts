// TypeScript types for Question-Driven Job Progression System
// Comprehensive type definitions matching the database schema

import { JobStatus, ResponseType, StageType } from '@/config/constants'

// =============================================
// 1. CORE STAGE SYSTEM TYPES
// =============================================

export interface JobStage {
  id: string;
  name: string;
  description?: string;
  color: string;
  sequence_order: number;
  maps_to_status: JobStatus;
  stage_type: StageType;
  min_duration_hours: number;
  max_duration_hours?: number;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface StageTransition {
  id: string;
  from_stage_id: string;
  to_stage_id: string;
  trigger_response: string;
  conditions: TransitionConditions;
  is_automatic: boolean;
  requires_admin_override: boolean;
  created_at: string;
  
  // Joined data
  from_stage?: JobStage;
  to_stage?: JobStage;
}

export interface TransitionConditions {
  question_id?: string;
  condition?: string; // e.g., ">=90", "<50"
  action?: string;
  [key: string]: any;
}

// =============================================
// 2. QUESTION SYSTEM TYPES
// =============================================

export type QuestionResponseType = ResponseType;

export interface StageQuestion {
  id: string;
  stage_id: string;
  question_text: string;
  response_type: QuestionResponseType;
  response_options?: string[]; // For multiple choice
  sequence_order: number;
  is_required: boolean;
  skip_conditions: SkipConditions;
  help_text?: string;
  mobile_optimized: boolean;
  created_at: string;
  
  // Joined data
  stage?: JobStage;
  upload_file_types?: string[];
  max_file_size_mb?: number;
}

export interface SkipConditions {
  job_types?: string[];
  previous_responses?: Array<{
    question_id: string;
    response_value: string;
  }>;
  [key: string]: any;
}

export interface UserResponse {
  id: string;
  job_id: string;
  question_id: string;
  response_value: string;
  response_metadata: ResponseMetadata;
  responded_by?: string;
  response_source: ResponseSource;
  is_client_response: boolean;
  created_at: string;
  
  // Joined data
  question?: StageQuestion;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface ResponseMetadata {
  file_urls?: string[];
  file_names?: string[];
  file_sizes?: number[];
  timestamp?: string;
  location?: {
    lat: number;
    lng: number;
  };
  [key: string]: any;
}

export type ResponseSource = 
  | 'web_app'
  | 'mobile_app'
  | 'sms'
  | 'email'
  | 'client_portal';

// =============================================
// 3. TASK SYSTEM TYPES
// =============================================

export type TaskType = 
  | 'reminder'
  | 'checklist'
  | 'documentation'
  | 'communication'
  | 'approval'
  | 'scheduling';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type TaskStatus = 
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export interface TaskTemplate {
  id: string;
  stage_id: string;
  task_type: TaskType;
  title: string;
  description?: string;
  subtasks: SubtaskTemplate[];
  upload_required: boolean;
  upload_file_types?: string[];
  max_file_size_mb: number;
  due_date_offset_hours: number;
  sla_hours?: number;
  priority: TaskPriority;
  auto_assign_to: 'creator' | 'foreman' | 'admin' | 'client';
  client_visible: boolean;
  created_at: string;
  
  // Joined data
  stage?: JobStage;
}

export interface SubtaskTemplate {
  id: string;
  title: string;
  description?: string;
  required: boolean;
  upload_required?: boolean;
  estimated_minutes?: number;
}

export interface JobTask {
  id: string;
  job_id: string;
  template_id: string;
  status: TaskStatus;
  title: string;
  description?: string;
  subtasks: SubtaskInstance[];
  assigned_to?: string;
  due_date?: string;
  completed_at?: string;
  upload_urls: string[];
  upload_verified: boolean;
  notes?: string;
  client_response_required: boolean;
  client_response_token?: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  template?: TaskTemplate;
  assignee?: {
    id: string;
    full_name: string;
    email: string;
  };
  job?: {
    id: string;
    title: string;
    client_name?: string;
  };
}

export interface SubtaskInstance {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  completed_at?: string;
  completed_by?: string;
  notes?: string;
  upload_urls?: string[];
}

// =============================================
// 4. AUDIT AND TRACKING TYPES
// =============================================

export type TriggerSource = 
  | 'question_response'
  | 'admin_override'
  | 'system_auto'
  | 'client_action';

export interface StageAuditLog {
  id: string;
  job_id: string;
  from_stage_id?: string;
  to_stage_id: string;
  from_status?: JobStatus;
  to_status: JobStatus;
  trigger_source: TriggerSource;
  triggered_by?: string;
  trigger_details: AuditTriggerDetails;
  question_id?: string;
  response_value?: string;
  duration_in_previous_stage_hours?: number;
  created_at: string;
  
  // Joined data
  from_stage?: JobStage;
  to_stage?: JobStage;
  triggered_by_user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface AuditTriggerDetails {
  source?: ResponseSource;
  metadata?: ResponseMetadata;
  reason?: string;
  admin_email?: string;
  error?: string;
  sqlstate?: string;
  [key: string]: any;
}

export interface StagePerformanceMetrics {
  id: string;
  job_id: string;
  stage_id: string;
  entered_at: string;
  exited_at?: string;
  duration_hours?: number;
  tasks_completed: number;
  tasks_overdue: number;
  conversion_successful?: boolean;
  created_at: string;
  
  // Joined data
  stage?: JobStage;
  job?: {
    id: string;
    title: string;
    client_name?: string;
  };
}

// =============================================
// 5. CLIENT PORTAL TYPES
// =============================================

export interface ClientPortalAccess {
  id: string;
  job_id: string;
  client_email: string;
  access_token: string;
  permissions: ClientPortalPermissions;
  expires_at: string;
  last_accessed_at?: string;
  created_at: string;
  
  // Joined data
  job?: {
    id: string;
    title: string;
    client_name?: string;
  };
}

export interface ClientPortalPermissions {
  questions?: string[]; // Question IDs client can respond to
  tasks?: string[]; // Task IDs client can view
  view_progress?: boolean;
  upload_files?: boolean;
  [key: string]: any;
}

// =============================================
// 6. API RESPONSE TYPES
// =============================================

export interface StageProgressionResult {
  success: boolean;
  action: 'stage_transition' | 'no_transition' | 'skipped' | 'admin_override';
  message: string;
  current_stage_id?: string;
  next_stage_id?: string;
  tasks_created?: number;
  duration_hours?: number;
  audit_id?: string;
  from_stage_id?: string;
  to_stage_id?: string;
}

export interface QuestionFlowState {
  job_id: string;
  current_stage_id: string;
  current_question?: StageQuestion;
  remaining_questions: StageQuestion[];
  completed_questions: UserResponse[];
  can_proceed: boolean;
  next_stage_preview?: JobStage;
}

export interface TaskUpdateRequest {
  status?: TaskStatus;
  subtasks?: SubtaskUpdateRequest[];
  notes?: string;
  upload_urls?: string[];
}

export interface SubtaskUpdateRequest {
  id: string;
  completed: boolean;
  notes?: string;
  upload_urls?: string[];
}

export interface StagePerformanceReport {
  stages: Array<{
    stage_name: string;
    total_entries: number;
    avg_duration_hours: number;
    median_duration_hours: number;
    avg_tasks_completed: number;
    avg_tasks_overdue: number;
    conversion_rate: number;
  }>;
  summary: {
    total_jobs: number;
    avg_cycle_time: number;
    overall_conversion_rate: number;
  };
}

export interface TaskSLAViolation {
  task_id: string;
  job_id: string;
  task_title: string;
  sla_hours: number;
  hours_overdue: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================
// 7. ENHANCED JOB TYPES
// =============================================

export interface EnhancedJob extends Job {
  current_stage_id?: string;
  stage_entered_at?: string;
  job_type: string;
  client_portal_enabled: boolean;
  mobile_optimized: boolean;
  
  // Joined data
  current_stage?: JobStage;
  stage_performance?: StagePerformanceMetrics[];
  active_tasks?: JobTask[];
  audit_history?: StageAuditLog[];
}

// =============================================
// 8. FORM AND UI TYPES
// =============================================

export interface QuestionFormData {
  question_id: string;
  response_value: string;
  response_metadata?: ResponseMetadata;
  files?: File[];
}

export interface StageOverrideFormData {
  target_stage_id: string;
  reason: string;
}

export interface TaskFormData {
  title: string;
  description?: string;
  subtasks: SubtaskFormData[];
  due_date?: string;
  priority: TaskPriority;
  assigned_to?: string;
  client_visible: boolean;
}

export interface SubtaskFormData {
  title: string;
  description?: string;
  required: boolean;
  upload_required?: boolean;
  estimated_minutes?: number;
}

// =============================================
// 9. UTILITY TYPES
// =============================================

export interface StageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TransitionValidationResult {
  can_transition: boolean;
  target_stage_id?: string;
  required_responses: string[];
  blocking_conditions: string[];
}

export interface FileUploadResult {
  success: boolean;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  error?: string;
}

// Import base types for compatibility
export type JobStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export interface Job {
  id: string;
  title: string;
  status: JobStatus;
  company_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // ... other existing Job fields
}