/**
 * Central Constants Configuration
 * 
 * This file contains all constant values used throughout the application
 * for consistent status handling, type mappings, and business logic.
 */

// =============================================
// JOB STATUS CONSTANTS
// =============================================

export const JOB_STATUSES = {
  PLANNING: 'planning',
  ACTIVE: 'active', 
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const

export type JobStatus = typeof JOB_STATUSES[keyof typeof JOB_STATUSES]

export const JOB_STATUS_LABELS = {
  [JOB_STATUSES.PLANNING]: 'Planning',
  [JOB_STATUSES.ACTIVE]: 'Active',
  [JOB_STATUSES.ON_HOLD]: 'On Hold',
  [JOB_STATUSES.COMPLETED]: 'Completed',
  [JOB_STATUSES.CANCELLED]: 'Cancelled'
} as const

export const JOB_STATUS_DESCRIPTIONS = {
  [JOB_STATUSES.PLANNING]: 'Job is in planning phase',
  [JOB_STATUSES.ACTIVE]: 'Job is actively in progress',
  [JOB_STATUSES.ON_HOLD]: 'Job is temporarily paused',
  [JOB_STATUSES.COMPLETED]: 'Job has been completed successfully',
  [JOB_STATUSES.CANCELLED]: 'Job has been cancelled'
} as const

// =============================================
// TASK STATUS CONSTANTS
// =============================================

export const TASK_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
  CANCELLED: 'cancelled'
} as const

export type TaskStatus = typeof TASK_STATUSES[keyof typeof TASK_STATUSES]

export const TASK_STATUS_LABELS = {
  [TASK_STATUSES.PENDING]: 'Pending',
  [TASK_STATUSES.IN_PROGRESS]: 'In Progress',
  [TASK_STATUSES.COMPLETED]: 'Completed',
  [TASK_STATUSES.ON_HOLD]: 'On Hold',
  [TASK_STATUSES.CANCELLED]: 'Cancelled'
} as const

// =============================================
// STAGE TYPE CONSTANTS
// =============================================

export const STAGE_TYPES = {
  STANDARD: 'standard',
  MILESTONE: 'milestone',
  APPROVAL: 'approval'
} as const

export type StageType = typeof STAGE_TYPES[keyof typeof STAGE_TYPES]

export const STAGE_TYPE_LABELS = {
  [STAGE_TYPES.STANDARD]: 'Standard',
  [STAGE_TYPES.MILESTONE]: 'Milestone',
  [STAGE_TYPES.APPROVAL]: 'Approval'
} as const

export const STAGE_TYPE_DESCRIPTIONS = {
  [STAGE_TYPES.STANDARD]: 'Regular stage in the job progression',
  [STAGE_TYPES.MILESTONE]: 'Important checkpoint or deliverable stage',
  [STAGE_TYPES.APPROVAL]: 'Stage requiring management approval to proceed'
} as const

// =============================================
// STAGE STATUS MAPPINGS
// =============================================

export const STAGE_STATUS_MAPPINGS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  COMPLETED: 'completed'
} as const

export type StageStatusMapping = typeof STAGE_STATUS_MAPPINGS[keyof typeof STAGE_STATUS_MAPPINGS]

// =============================================
// PRIORITY CONSTANTS
// =============================================

export const PRIORITY_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
} as const

export type PriorityLevel = typeof PRIORITY_LEVELS[keyof typeof PRIORITY_LEVELS]

export const PRIORITY_LABELS = {
  [PRIORITY_LEVELS.LOW]: 'Low',
  [PRIORITY_LEVELS.MEDIUM]: 'Medium',
  [PRIORITY_LEVELS.HIGH]: 'High',
  [PRIORITY_LEVELS.URGENT]: 'Urgent'
} as const

export const PRIORITY_VALUES = {
  [PRIORITY_LEVELS.LOW]: 1,
  [PRIORITY_LEVELS.MEDIUM]: 2,
  [PRIORITY_LEVELS.HIGH]: 3,
  [PRIORITY_LEVELS.URGENT]: 4
} as const

// =============================================
// RESPONSE TYPE CONSTANTS
// =============================================

export const RESPONSE_TYPES = {
  YES_NO: 'yes_no',
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  FILE_UPLOAD: 'file_upload',
  MULTIPLE_CHOICE: 'multiple_choice'
} as const

export type ResponseType = typeof RESPONSE_TYPES[keyof typeof RESPONSE_TYPES]

export const RESPONSE_TYPE_LABELS = {
  [RESPONSE_TYPES.YES_NO]: 'Yes/No',
  [RESPONSE_TYPES.TEXT]: 'Text Input',
  [RESPONSE_TYPES.NUMBER]: 'Number',
  [RESPONSE_TYPES.DATE]: 'Date',
  [RESPONSE_TYPES.FILE_UPLOAD]: 'File Upload',
  [RESPONSE_TYPES.MULTIPLE_CHOICE]: 'Multiple Choice'
} as const

export const RESPONSE_TYPE_DESCRIPTIONS = {
  [RESPONSE_TYPES.YES_NO]: 'Simple yes/no question',
  [RESPONSE_TYPES.TEXT]: 'Free text response',
  [RESPONSE_TYPES.NUMBER]: 'Numeric value input',
  [RESPONSE_TYPES.DATE]: 'Date selection',
  [RESPONSE_TYPES.FILE_UPLOAD]: 'File attachment',
  [RESPONSE_TYPES.MULTIPLE_CHOICE]: 'Select from predefined options'
} as const

// Response type configuration for UI components
// Icons should be imported from lucide-react where used
export const RESPONSE_TYPE_CONFIG = [
  { 
    value: RESPONSE_TYPES.YES_NO, 
    label: RESPONSE_TYPE_LABELS[RESPONSE_TYPES.YES_NO],
    description: RESPONSE_TYPE_DESCRIPTIONS[RESPONSE_TYPES.YES_NO],
    iconName: 'ToggleLeft'
  },
  { 
    value: RESPONSE_TYPES.TEXT, 
    label: RESPONSE_TYPE_LABELS[RESPONSE_TYPES.TEXT],
    description: RESPONSE_TYPE_DESCRIPTIONS[RESPONSE_TYPES.TEXT],
    iconName: 'Type'
  },
  { 
    value: RESPONSE_TYPES.NUMBER, 
    label: RESPONSE_TYPE_LABELS[RESPONSE_TYPES.NUMBER],
    description: RESPONSE_TYPE_DESCRIPTIONS[RESPONSE_TYPES.NUMBER],
    iconName: 'Hash'
  },
  { 
    value: RESPONSE_TYPES.DATE, 
    label: RESPONSE_TYPE_LABELS[RESPONSE_TYPES.DATE],
    description: RESPONSE_TYPE_DESCRIPTIONS[RESPONSE_TYPES.DATE],
    iconName: 'Calendar'
  },
  { 
    value: RESPONSE_TYPES.MULTIPLE_CHOICE, 
    label: RESPONSE_TYPE_LABELS[RESPONSE_TYPES.MULTIPLE_CHOICE],
    description: RESPONSE_TYPE_DESCRIPTIONS[RESPONSE_TYPES.MULTIPLE_CHOICE],
    iconName: 'Target'
  },
  { 
    value: RESPONSE_TYPES.FILE_UPLOAD, 
    label: RESPONSE_TYPE_LABELS[RESPONSE_TYPES.FILE_UPLOAD],
    description: RESPONSE_TYPE_DESCRIPTIONS[RESPONSE_TYPES.FILE_UPLOAD],
    iconName: 'Upload'
  }
] as const

// =============================================
// USER ROLE CONSTANTS
// =============================================

export const USER_ROLES = {
  SITE_ADMIN: 'site_admin',
  OWNER: 'owner',
  ADMIN: 'admin',
  FOREMAN: 'foreman',
  WORKER: 'worker',
  CLIENT: 'client'
} as const

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES]

export const USER_ROLE_LABELS = {
  [USER_ROLES.SITE_ADMIN]: 'Site Administrator',
  [USER_ROLES.OWNER]: 'Owner',
  [USER_ROLES.ADMIN]: 'Administrator',
  [USER_ROLES.FOREMAN]: 'Foreman',
  [USER_ROLES.WORKER]: 'Worker',
  [USER_ROLES.CLIENT]: 'Client'
} as const

// =============================================
// TRANSITION TYPES
// =============================================

export const TRANSITION_TYPES = {
  AUTOMATIC: 'automatic',
  MANUAL: 'manual',
  CONDITIONAL: 'conditional'
} as const

export type TransitionType = typeof TRANSITION_TYPES[keyof typeof TRANSITION_TYPES]

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Get job status label
 */
export const getJobStatusLabel = (status: string): string => {
  return JOB_STATUS_LABELS[status as JobStatus] || status
}

/**
 * Get task status label
 */
export const getTaskStatusLabel = (status: string): string => {
  return TASK_STATUS_LABELS[status as TaskStatus] || status
}

/**
 * Get priority label
 */
export const getPriorityLabel = (priority: string): string => {
  return PRIORITY_LABELS[priority as PriorityLevel] || priority
}

/**
 * Get priority value
 */
export const getPriorityValue = (priority: string): number => {
  return PRIORITY_VALUES[priority as PriorityLevel] || 0
}

/**
 * Get response type label
 */
export const getResponseTypeLabel = (responseType: string): string => {
  return RESPONSE_TYPE_LABELS[responseType as ResponseType] || responseType
}

/**
 * Get user role label
 */
export const getUserRoleLabel = (role: string): string => {
  return USER_ROLE_LABELS[role as UserRole] || role
}

/**
 * Check if job status is final (cannot be changed)
 */
export const isJobStatusFinal = (status: string): boolean => {
  return status === JOB_STATUSES.COMPLETED || status === JOB_STATUSES.CANCELLED
}

/**
 * Check if task status is final
 */
export const isTaskStatusFinal = (status: string): boolean => {
  return status === TASK_STATUSES.COMPLETED || status === TASK_STATUSES.CANCELLED
}

/**
 * Get allowed job status transitions
 */
export const getAllowedJobStatusTransitions = (currentStatus: string): string[] => {
  switch (currentStatus) {
    case JOB_STATUSES.PLANNING:
      return [JOB_STATUSES.ACTIVE, JOB_STATUSES.CANCELLED]
    case JOB_STATUSES.ACTIVE:
      return [JOB_STATUSES.ON_HOLD, JOB_STATUSES.COMPLETED, JOB_STATUSES.CANCELLED]
    case JOB_STATUSES.ON_HOLD:
      return [JOB_STATUSES.ACTIVE, JOB_STATUSES.CANCELLED]
    case JOB_STATUSES.COMPLETED:
    case JOB_STATUSES.CANCELLED:
      return [] // Final states
    default:
      return []
  }
}

/**
 * Get all job statuses as array
 */
export const getAllJobStatuses = (): JobStatus[] => {
  return Object.values(JOB_STATUSES)
}

/**
 * Get all task statuses as array
 */
export const getAllTaskStatuses = (): TaskStatus[] => {
  return Object.values(TASK_STATUSES)
}

/**
 * Get all response types as array
 */
export const getAllResponseTypes = (): ResponseType[] => {
  return Object.values(RESPONSE_TYPES)
}

/**
 * Get all priority levels as array
 */
export const getAllPriorityLevels = (): PriorityLevel[] => {
  return Object.values(PRIORITY_LEVELS)
}

/**
 * Get all user roles as array
 */
export const getAllUserRoles = (): UserRole[] => {
  return Object.values(USER_ROLES)
}

// =============================================
// VALIDATION HELPERS
// =============================================

/**
 * Validate job status
 */
export const isValidJobStatus = (status: string): status is JobStatus => {
  return Object.values(JOB_STATUSES).includes(status as JobStatus)
}

/**
 * Validate task status
 */
export const isValidTaskStatus = (status: string): status is TaskStatus => {
  return Object.values(TASK_STATUSES).includes(status as TaskStatus)
}

/**
 * Validate response type
 */
export const isValidResponseType = (responseType: string): responseType is ResponseType => {
  return Object.values(RESPONSE_TYPES).includes(responseType as ResponseType)
}

/**
 * Validate priority level
 */
export const isValidPriorityLevel = (priority: string): priority is PriorityLevel => {
  return Object.values(PRIORITY_LEVELS).includes(priority as PriorityLevel)
}

/**
 * Validate user role
 */
export const isValidUserRole = (role: string): role is UserRole => {
  return Object.values(USER_ROLES).includes(role as UserRole)
}