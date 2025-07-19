// Shared types from the mobile app - keeping consistency
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'owner' | 'foreman' | 'worker' | 'site_admin';
  company_id: string | null; // null for site_admin
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Extended company interface for site admin
export interface CompanyWithStats extends Company {
  user_count: number;
  job_count: number;
  active_job_count: number;
}

// Platform statistics for site admin
export interface PlatformStats {
  total_companies: number;
  total_users: number;
  total_jobs: number;
  active_jobs: number;
  total_workers: number;
  recent_signups: number;
}

// Site admin user view
export interface SiteAdminUser extends User {
  company_name?: string;
}

// Site admin job view
export interface SiteAdminJob extends Job {
  company_name?: string;
  created_by_name?: string;
}

// Project hierarchy types for Job-Ops platform
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  
  // Client and location
  client_name?: string;
  site_address?: string;
  address_components?: {
    formatted: string;
    street?: string;
    house_number?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  latitude?: number;
  longitude?: number;
  
  // Timeline and budget
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  total_budget?: number;
  
  // Team assignments
  project_manager_id?: string;
  
  // Company and audit
  company_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  project_manager?: {
    id: string;
    full_name: string;
    email: string;
  };
  stages?: ProjectStage[];
  jobs?: Job[];
}

export interface ProjectStageTemplate {
  id: string;
  template_name: string;
  description?: string;
  industry_type?: string;
  project_type?: string;
  is_system_template: boolean;
  company_id?: string;
  stages: ProjectStageDefinition[];
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  created_by_user?: {
    full_name: string;
    email: string;
  };
  company?: Company;
}

export interface ProjectStageDefinition {
  name: string;
  color: string;
  sequence: number;
  estimated_days: number;
  requires_client_meeting?: boolean;
  weather_sensitive?: boolean;
}

export interface ProjectStage {
  id: string;
  project_id: string;
  stage_name: string;
  description?: string;
  sequence_order: number;
  color: string;
  status: 'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  
  // Timeline
  planned_start_date?: string;
  planned_end_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  
  // Client meeting requirements
  requires_client_meeting: boolean;
  client_meeting_scheduled_at?: string;
  client_meeting_completed: boolean;
  
  // Weather sensitivity
  weather_sensitive: boolean;
  
  // Dependencies
  depends_on_stage_ids?: string[];
  
  // Assignments
  assigned_foreman_id?: string;
  
  // Progress tracking
  completion_percentage: number;
  
  // Audit
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  project?: Project;
  assigned_foreman?: {
    id: string;
    full_name: string;
    email: string;
  };
  jobs?: Job[];
}

export interface ProjectStageHistory {
  id: string;
  stage_id: string;
  old_status?: string;
  new_status?: string;
  old_completion_percentage?: number;
  new_completion_percentage?: number;
  changed_by: string;
  changed_at: string;
  change_reason?: string;
  notes?: string;
  
  // Joined data
  changed_by_user?: {
    full_name: string;
    email: string;
  };
  stage?: ProjectStage;
}

export interface ProjectSummary {
  project_id: string;
  project_name: string;
  total_stages: number;
  completed_stages: number;
  total_jobs: number;
  completed_jobs: number;
  overall_completion: number;
  estimated_hours: number;
  actual_hours: number;
}

// Extended project interfaces for different views
export interface ProjectWithStats extends Project {
  total_stages: number;
  completed_stages: number;
  total_jobs: number;
  completed_jobs: number;
  overall_completion: number;
  estimated_hours: number;
  actual_hours: number;
  active_workers: number;
}

export interface ProjectGanttData extends Project {
  stages: (ProjectStage & {
    start_date: string;
    end_date: string;
    duration_days: number;
    progress: number;
  })[];
}

export interface Job {
  id: string;
  title: string;
  description?: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  start_date: string;
  end_date: string;
  budget?: number;
  client_name?: string;
  location?: string;
  address_components?: {
    formatted: string;
    street?: string;
    house_number?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  latitude?: number;
  longitude?: number;
  foreman_id?: string;
  
  // Project hierarchy fields (new for Job-Ops)
  project_id?: string;
  project_stage_id?: string;
  is_standalone: boolean; // true for jobs not part of project structure
  
  company_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  foreman?: {
    id: string;
    full_name: string;
    email: string;
  };
  project?: Project;
  project_stage?: ProjectStage;
}

export interface JobStatusHistory {
  id: string;
  job_id: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  changed_at: string;
  changed_by: string;
  changed_by_name: string;
  notes?: string;
  duration_days: number;
  is_current: boolean;
}

export interface JobStatusTimeline {
  job_id: string;
  history: JobStatusHistory[];
}

export interface Worker {
  id: string;
  user_id?: string;
  employee_id?: string;
  phone?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  address?: string;
  hourly_rate?: number;
  hire_date?: string;
  employment_status: 'active' | 'inactive' | 'terminated';
  notes?: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Joined user data
  users?: {
    id: string;
    full_name: string;
    email: string;
    role: 'owner' | 'foreman' | 'worker' | 'site_admin';
  };
  // Worker skills
  skills?: WorkerSkill[];
}

export interface JobAssignment {
  id: string;
  job_id: string;
  worker_id: string;
  role?: string; // Changed from assignment_role to match database schema
  assigned_date: string;
  assigned_by?: string;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  worker?: Worker;
  job?: Job;
  assigned_by_user?: {
    full_name: string;
    email: string;
  };
}

export interface WorkerSkill {
  id: string;
  worker_id: string;
  skill_name: string;
  skill_category: 'certification' | 'specialty' | 'equipment' | 'software';
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  certification_number?: string;
  issued_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  is_verified: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkerLicense {
  id: string;
  worker_id: string;
  license_type: string;
  license_number?: string;
  issue_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  document_url?: string;
  document_filename?: string;
  document_size?: number;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PasswordResetToken {
  id: string;
  user_id: string;
  temp_password_hash: string;
  expires_at: string;
  used: boolean;
  used_at?: string;
  created_by?: string;
  created_at: string;
}

export interface EmployeeIdSequence {
  id: string;
  company_id: string;
  next_sequence: number;
  created_at: string;
  updated_at: string;
}

export interface WorkerCheckIn {
  id: string;
  worker_id: string;
  job_id: string;
  check_in_time: string;
  check_out_time?: string;
  location?: string;
  break_duration?: number; // minutes
  notes?: string;
  gps_accuracy?: number; // meters
  is_approved: boolean;
  created_at: string;
  // Joined data
  worker?: Worker;
  job?: Job;
}

// Time Tracking Types (Phase 7)
export interface TimeEntry {
  id: string;
  worker_id: string;
  job_id: string;
  task_id?: string;
  check_in_id?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  break_duration_minutes: number;
  description?: string;
  entry_type: 'regular' | 'overtime' | 'break' | 'travel';
  start_location?: string;
  end_location?: string;
  start_gps_lat?: number;
  start_gps_lng?: number;
  end_gps_lat?: number;
  end_gps_lng?: number;
  status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  hourly_rate?: number;
  overtime_rate?: number;
  total_cost?: number;
  company_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  worker?: Worker;
  job?: Job;
  task?: Task;
  check_in?: WorkerCheckIn;
  approved_by_user?: {
    full_name: string;
    email: string;
  };
  created_by_user?: {
    full_name: string;
    email: string;
  };
  break_entries?: BreakEntry[];
}

export interface BreakEntry {
  id: string;
  time_entry_id: string;
  worker_id: string;
  break_type: 'lunch' | 'general' | 'smoke' | 'personal' | 'rest';
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  is_paid: boolean;
  notes?: string;
  location?: string;
  gps_lat?: number;
  gps_lng?: number;
  created_at: string;
  updated_at: string;
  // Joined data
  time_entry?: TimeEntry;
  worker?: Worker;
}

export interface TimeApproval {
  id: string;
  time_entry_id: string;
  approver_id: string;
  worker_id: string;
  approval_status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  approval_date?: string;
  approver_notes?: string;
  requested_changes?: string;
  worker_response?: string;
  original_start_time?: string;
  original_end_time?: string;
  approved_start_time?: string;
  approved_end_time?: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  time_entry?: TimeEntry;
  approver?: User;
  worker?: Worker;
}

export interface OvertimeRule {
  id: string;
  company_id: string;
  rule_name: string;
  description?: string;
  daily_overtime_threshold: number; // hours
  daily_overtime_multiplier: number;
  weekly_overtime_threshold: number; // hours
  weekly_overtime_multiplier: number;
  double_time_threshold?: number; // hours
  double_time_multiplier: number;
  weekend_multiplier: number;
  holiday_multiplier: number;
  is_active: boolean;
  effective_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  company?: Company;
}

export interface TimeSummary {
  id: string;
  worker_id: string;
  job_id?: string;
  company_id: string;
  period_type: 'daily' | 'weekly' | 'monthly';
  period_start: string;
  period_end: string;
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
  total_minutes: number;
  regular_cost: number;
  overtime_cost: number;
  total_cost: number;
  is_approved: boolean;
  approved_by?: string;
  approved_at?: string;
  last_calculated: string;
  created_at: string;
  updated_at: string;
  // Joined data
  worker?: Worker;
  job?: Job;
  company?: Company;
  approved_by_user?: {
    full_name: string;
    email: string;
  };
}

// Time Tracking Utility Types
export interface TimeClockStatus {
  is_clocked_in: boolean;
  current_check_in?: WorkerCheckIn;
  current_time_entry?: TimeEntry;
  active_break?: BreakEntry;
  total_hours_today: number;
  break_time_today: number;
  overtime_hours_today: number;
}

export interface TimesheetData {
  period_start: string;
  period_end: string;
  time_entries: TimeEntry[];
  total_regular_hours: number;
  total_overtime_hours: number;
  total_break_hours: number;
  total_cost: number;
  approval_status: 'pending' | 'approved' | 'rejected' | 'partial';
  worker: Worker;
  job?: Job;
}

export interface TimeTrackingStats {
  total_workers: number;
  active_workers: number;
  total_hours_today: number;
  total_hours_week: number;
  labor_cost_today: number;
  labor_cost_week: number;
  pending_approvals: number;
  overtime_hours_week: number;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  address?: string;
  speed?: number | null;
  heading?: number | null;
}

export interface Document {
  id: string;
  name: string;
  type: 'photo' | 'contract' | 'permit' | 'report' | 'other';
  url: string;
  job_id?: string;
  uploaded_by: string;
  file_size?: number;
  created_at: string;
}

export interface DailyLog {
  id: string;
  job_id: string;
  log_date: string;
  weather_conditions?: string;
  work_completed: string;
  materials_used?: string;
  workers_present?: number;
  notes?: string;
  created_by: string;
  created_at: string;
}

export interface Task {
  id: string;
  job_id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string; // Legacy field - now use task_assignments
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  parent_task_id?: string;
  sort_order?: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Legacy fields from joins
  assigned_user?: {
    full_name: string;
    email: string;
  };
  // New multi-worker assignment fields
  assignedWorkers?: Worker[];
  taskAssignments?: TaskAssignment[];
  subtasks?: Task[];
}

export interface TaskAssignment {
  id: string;
  task_id: string;
  worker_id: string;
  assigned_date: string;
  assigned_by?: string;
  created_at: string;
  updated_at?: string;
  // Joined data
  worker?: Worker;
  assigned_by_user?: {
    full_name: string;
    email: string;
  };
}

// Document Management Types
export interface DocumentCategory {
  id: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  sort_order: number;
  is_system: boolean;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  description?: string;
  original_filename: string;
  file_extension: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  storage_bucket: string;
  file_url?: string;
  category_id?: string;
  job_id?: string;
  task_id?: string;
  document_date?: string;
  tags?: string[];
  version_number: number;
  parent_document_id?: string;
  latitude?: number;
  longitude?: number;
  location_name?: string;
  is_public: boolean;
  share_token?: string;
  share_expires_at?: string;
  uploaded_by: string;
  company_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  category?: DocumentCategory;
  job?: Job;
  task?: Task;
  uploaded_by_user?: {
    full_name: string;
    email: string;
  };
  parent_document?: Document;
  versions?: Document[];
}

export interface DocumentAccessLog {
  id: string;
  document_id: string;
  accessed_by?: string;
  access_type: 'view' | 'download' | 'share';
  client_ip?: string;
  user_agent?: string;
  accessed_at: string;
  // Joined data
  accessed_by_user?: {
    full_name: string;
    email: string;
  };
}

export interface DocumentComment {
  id: string;
  document_id: string;
  comment_text: string;
  commented_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  commented_by_user?: {
    full_name: string;
    email: string;
  };
}

export interface DocumentUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  document?: Document;
}

// Worker Application Types
export interface WorkerApplication {
  id: string;
  company_id: string;
  
  // Personal Information
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  
  // Work Information
  desired_hourly_rate?: number;
  availability?: string; // JSON string
  work_experience?: string;
  previous_employer?: string;
  years_experience?: number;
  
  // Skills and Certifications (JSON arrays)
  skills?: string; // JSON array
  certifications?: string; // JSON array
  licenses?: string; // JSON array
  
  // Documents
  resume_url?: string;
  resume_filename?: string;
  resume_size?: number;
  cover_letter?: string;
  
  // References
  reference1_name?: string;
  reference1_phone?: string;
  reference1_email?: string;
  reference1_relationship?: string;
  reference2_name?: string;
  reference2_phone?: string;
  reference2_email?: string;
  reference2_relationship?: string;
  
  // Emergency Contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  
  // Application Status
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  applied_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewer_notes?: string;
  rejection_reason?: string;
  
  // Tracking
  source?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  
  // Joined data
  reviewed_by_user?: {
    full_name: string;
    email: string;
  };
  company?: Company;
}

export interface AssignmentAccessLog {
  id: string;
  assignment_id: string;
  share_token?: string;
  accessed_by_worker_id?: string;
  access_type: 'view' | 'download' | 'update';
  client_ip?: string;
  user_agent?: string;
  accessed_at: string;
  
  // Joined data
  assignment?: JobAssignment;
  worker?: Worker;
}

// Extended JobAssignment interface with sharing capabilities
export interface JobAssignmentWithSharing extends JobAssignment {
  share_token?: string;
  is_public: boolean;
  share_expires_at?: string;
  shared_by?: string;
  shared_at?: string;
  
  // Joined data for sharing
  shared_by_user?: {
    full_name: string;
    email: string;
  };
}

// Worker Application Form Data
export interface WorkerApplicationFormData {
  // Personal Information
  full_name: string;
  email: string;
  phone: string;
  address: string;
  date_of_birth: string;
  
  // Work Information
  desired_hourly_rate: number;
  availability: {
    monday: { available: boolean; start?: string; end?: string };
    tuesday: { available: boolean; start?: string; end?: string };
    wednesday: { available: boolean; start?: string; end?: string };
    thursday: { available: boolean; start?: string; end?: string };
    friday: { available: boolean; start?: string; end?: string };
    saturday: { available: boolean; start?: string; end?: string };
    sunday: { available: boolean; start?: string; end?: string };
  };
  work_experience: string;
  previous_employer: string;
  years_experience: number;
  
  // Skills and Certifications
  skills: string[];
  certifications: { name: string; issuer: string; date: string }[];
  licenses: { type: string; number: string; expiry: string }[];
  
  // Documents
  resume?: File;
  cover_letter: string;
  
  // References
  references: {
    name: string;
    phone: string;
    email: string;
    relationship: string;
  }[];
  
  // Emergency Contact
  emergency_contact: {
    name: string;
    phone: string;
    relationship: string;
  };
  
  // Source
  source: string;
}

// Auth store interface
export interface AuthState {
  user: User | null;
  company: Company | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: User['role'], companyName?: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  createProfile: (fullName: string, role: User['role'], companyName?: string) => Promise<void>;
}