/**
 * Central configuration for timeouts, delays, and timing-related constants
 * Part of Category 6: Configuration Values & Timeouts - HARDCODE_REVIEW.md
 */

export const TIMEOUTS = {
  // UI Feedback & Notifications
  COPY_SUCCESS_FEEDBACK: 2000,          // ms - Success message display duration
  NOTIFICATION_AUTO_HIDE: 5000,         // ms - Auto-hide notifications
  
  // QR Code & Check-in
  QR_CHECKIN_REDIRECT: 3000,           // ms - Auto-redirect after QR check-in
  
  // Geolocation
  GEOLOCATION_TIMEOUT: 10000,          // ms - GPS position timeout
  GEOLOCATION_MAX_AGE: 300000,         // ms - 5 minutes - Maximum age of cached position
  
  // API & Network
  API_REQUEST_DEFAULT: 30000,          // ms - Default API request timeout
  UPLOAD_PROGRESS_INTERVAL: 200,      // ms - File upload progress update interval
  
  // Form & UI Interactions
  SEARCH_DEBOUNCE: 300,               // ms - Search input debounce delay
  LOADING_ANIMATION_MIN: 1000,        // ms - Minimum loading animation duration
  
  // Data Refresh
  AUTO_REFRESH_INTERVAL: 30000,       // ms - Auto-refresh data interval
  POLLING_INTERVAL: 5000,             // ms - Real-time polling interval
} as const

export const LIMITS = {
  // Pagination & Data Fetching
  API_PAGE_SIZE_DEFAULT: 50,          // Default page size for API responses
  API_PAGE_SIZE_LARGE: 100,           // Large page size for bulk operations
  
  // File Operations
  MAX_FILE_SIZE_DOCUMENT: 50,         // MB - Maximum document file size
  MAX_FILE_SIZE_PHOTO: 20,            // MB - Maximum photo file size
  MAX_FILE_SIZE_LICENSE: 5,           // MB - Maximum license document size
  MAX_FILES_UPLOAD: 10,               // Maximum files per upload
  MAX_FILES_QUESTION: 5,              // Maximum files per question response
  
  // Content Limits
  QR_CODE_SIZE_DEFAULT: 256,          // px - Default QR code size
  QR_CODE_SIZE_EXPORT: 512,           // px - Export QR code size
  
  // Chart & UI Display
  GANTT_CHART_MAX_HEIGHT: 600,        // px - Maximum Gantt chart height
  SIGNATURE_MIN_WIDTH: 1,             // px - Signature pen minimum width
  SIGNATURE_MAX_WIDTH: 3,             // px - Signature pen maximum width
  
  // Text & Input Limits
  DESCRIPTION_MIN_LENGTH: 6,          // Minimum password/description length
  WORK_RATE_MIN: 15,                  // Minimum hourly work rate
  WORK_RATE_MAX: 100,                 // Maximum hourly work rate
  EXPERIENCE_MIN: 0,                  // Minimum years of experience
  EXPERIENCE_MAX: 50,                 // Maximum years of experience
} as const

export const UI_CONFIG = {
  // Responsive Design
  MOBILE_BREAKPOINT: 768,             // px - Mobile/desktop breakpoint
  
  // Animation & Transitions
  TRANSITION_DURATION: 200,           // ms - Standard UI transition duration
  
  // Search & Autocomplete
  AUTOCOMPLETE_LIMIT: 5,              // Maximum autocomplete suggestions
  
  // Map & Location
  MAP_ZOOM_DEFAULT: 18,               // Default map zoom level for reverse geocoding
  
  // Progress Tracking
  PROGRESS_BAR_MAX: 100,              // Maximum progress bar value
  
  // Form Validation
  FORM_SUBMIT_DELAY: 1000,           // ms - Delay after form submission (prevent double-submit)
} as const

// Helper functions for accessing configuration values
export const getTimeout = (key: keyof typeof TIMEOUTS): number => TIMEOUTS[key]
export const getLimit = (key: keyof typeof LIMITS): number => LIMITS[key]
export const getUIConfig = (key: keyof typeof UI_CONFIG): number => UI_CONFIG[key]

// Type exports for better type checking
export type TimeoutKey = keyof typeof TIMEOUTS
export type LimitKey = keyof typeof LIMITS
export type UIConfigKey = keyof typeof UI_CONFIG