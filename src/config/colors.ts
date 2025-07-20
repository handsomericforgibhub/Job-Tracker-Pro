/**
 * Central Color Configuration
 * 
 * This file contains all color definitions used throughout the application
 * for consistent theming and easier maintenance.
 */

export const THEME_COLORS = {
  // Stage colors - Used in stage management, job workflows, and analytics
  STAGES: {
    LEAD_QUALIFICATION: '#EF4444',        // Red
    INITIAL_CLIENT_MEETING: '#F97316',    // Orange
    SITE_ASSESSMENT: '#EAB308',           // Yellow
    QUOTE_SUBMISSION: '#84CC16',          // Lime
    CLIENT_DECISION: '#22C55E',           // Green
    CONTRACT_DEPOSIT: '#06B6D4',          // Cyan
    MATERIAL_ORDERING: '#3B82F6',         // Blue
    MATERIAL_DELIVERY: '#6366F1',         // Indigo
    CONSTRUCTION_START: '#8B5CF6',        // Purple
    QUALITY_INSPECTIONS: '#EC4899',       // Pink
    CLIENT_WALKTHROUGH: '#F59E0B',        // Amber
    HANDOVER_CLOSE: '#10B981',            // Emerald
  },

  // Priority colors - Used for task and job priorities
  PRIORITY: {
    LOW: '#6B7280',        // Gray
    MEDIUM: '#F59E0B',     // Amber
    HIGH: '#EF4444',       // Red
    URGENT: '#DC2626',     // Dark Red
  },

  // Status colors - Used for job and task statuses
  STATUS: {
    TODO: '#6B7280',       // Gray - To Do
    IN_PROGRESS: '#3B82F6', // Blue - In Progress  
    COMPLETED: '#10B981',   // Emerald - Completed
    BLOCKED: '#EF4444',     // Red - Blocked
    ON_HOLD: '#F59E0B',     // Amber - On Hold
    CANCELLED: '#DC2626',   // Dark Red - Cancelled
  },

  // Chart colors - Used in analytics and reporting
  CHARTS: {
    PRIMARY: '#8884d8',     // Purple-blue
    SECONDARY: '#82ca9d',   // Green
    TERTIARY: '#ffc658',    // Yellow-orange
    QUATERNARY: '#ff7c7c',  // Light red
    QUINARY: '#8dd1e1',     // Light blue
    SENARY: '#d084d0',      // Light purple
  },

  // System UI colors
  SYSTEM: {
    SUCCESS: '#10B981',     // Emerald
    WARNING: '#F59E0B',     // Amber
    ERROR: '#EF4444',       // Red
    INFO: '#3B82F6',        // Blue
    NEUTRAL: '#6B7280',     // Gray
  },

  // Background variants for different states
  BACKGROUNDS: {
    SUCCESS_LIGHT: '#ECFDF5',     // Light green
    WARNING_LIGHT: '#FFFBEB',     // Light amber
    ERROR_LIGHT: '#FEF2F2',       // Light red
    INFO_LIGHT: '#EFF6FF',        // Light blue
    NEUTRAL_LIGHT: '#F9FAFB',     // Light gray
  },

  // Text variants for different contexts
  TEXT: {
    SUCCESS: '#065F46',     // Dark green
    WARNING: '#92400E',     // Dark amber
    ERROR: '#991B1B',       // Dark red
    INFO: '#1E40AF',        // Dark blue
    NEUTRAL: '#374151',     // Dark gray
  },
} as const

// Helper function to get stage color by stage name
export const getStageColor = (stageName: string): string => {
  const stageKey = stageName
    .toUpperCase()
    .replace(/^\d+\/\d+\s*/, '') // Remove "1/12 " prefix
    .replace(/\s+/g, '_')        // Replace spaces with underscores
    .replace(/[&]/g, '')         // Remove ampersands
    
  switch (stageKey) {
    case 'LEAD_QUALIFICATION':
      return THEME_COLORS.STAGES.LEAD_QUALIFICATION
    case 'INITIAL_CLIENT_MEETING':
      return THEME_COLORS.STAGES.INITIAL_CLIENT_MEETING
    case 'SITE_ASSESSMENT_QUOTE':
      return THEME_COLORS.STAGES.SITE_ASSESSMENT
    case 'QUOTE_SUBMISSION':
      return THEME_COLORS.STAGES.QUOTE_SUBMISSION
    case 'CLIENT_DECISION':
      return THEME_COLORS.STAGES.CLIENT_DECISION
    case 'CONTRACT_DEPOSIT':
      return THEME_COLORS.STAGES.CONTRACT_DEPOSIT
    case 'MATERIAL_ORDERING':
      return THEME_COLORS.STAGES.MATERIAL_ORDERING
    case 'MATERIAL_DELIVERY':
      return THEME_COLORS.STAGES.MATERIAL_DELIVERY
    case 'CONSTRUCTION_START':
      return THEME_COLORS.STAGES.CONSTRUCTION_START
    case 'QUALITY_INSPECTIONS':
      return THEME_COLORS.STAGES.QUALITY_INSPECTIONS
    case 'CLIENT_WALKTHROUGH':
      return THEME_COLORS.STAGES.CLIENT_WALKTHROUGH
    case 'HANDOVER_CLOSE':
      return THEME_COLORS.STAGES.HANDOVER_CLOSE
    default:
      return THEME_COLORS.SYSTEM.NEUTRAL
  }
}

// Helper function to get priority color
export const getPriorityColor = (priority: string): string => {
  switch (priority.toLowerCase()) {
    case 'low':
      return THEME_COLORS.PRIORITY.LOW
    case 'medium':
      return THEME_COLORS.PRIORITY.MEDIUM
    case 'high':
      return THEME_COLORS.PRIORITY.HIGH
    case 'urgent':
      return THEME_COLORS.PRIORITY.URGENT
    default:
      return THEME_COLORS.PRIORITY.MEDIUM
  }
}

// Helper function to get status color
export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'todo':
    case 'pending':
    case 'planning':
      return THEME_COLORS.STATUS.TODO
    case 'in_progress':
    case 'active':
      return THEME_COLORS.STATUS.IN_PROGRESS
    case 'completed':
      return THEME_COLORS.STATUS.COMPLETED
    case 'blocked':
      return THEME_COLORS.STATUS.BLOCKED
    case 'on_hold':
      return THEME_COLORS.STATUS.ON_HOLD
    case 'cancelled':
      return THEME_COLORS.STATUS.CANCELLED
    default:
      return THEME_COLORS.STATUS.TODO
  }
}

// Chart color palette for consistent data visualization
export const CHART_COLOR_PALETTE = [
  THEME_COLORS.CHARTS.PRIMARY,
  THEME_COLORS.CHARTS.SECONDARY,
  THEME_COLORS.CHARTS.TERTIARY,
  THEME_COLORS.CHARTS.QUATERNARY,
  THEME_COLORS.CHARTS.QUINARY,
  THEME_COLORS.CHARTS.SENARY,
]

// Export individual color sets for easier imports
export const STAGE_COLORS = THEME_COLORS.STAGES
export const PRIORITY_COLORS = THEME_COLORS.PRIORITY
export const STATUS_COLORS = THEME_COLORS.STATUS
export const CHART_COLORS = THEME_COLORS.CHARTS
export const SYSTEM_COLORS = THEME_COLORS.SYSTEM