/**
 * Central Endpoints Configuration
 * 
 * This file contains all external URLs and API endpoints used throughout the application
 * for consistent configuration and environment-specific management.
 */

// =============================================
// SUPABASE CONFIGURATION
// =============================================

export const SUPABASE_CONFIG = {
  // Default Supabase URLs - can be overridden by environment variables
  DEFAULT_URL: 'https://demo.supabase.co',
  DEFAULT_ANON_KEY: 'demo-anon-key',
  
  // Fallback configuration for development/demo
  FALLBACK_CONFIG: {
    url: 'https://demo.supabase.co',
    anonKey: 'demo-anon-key'
  }
} as const

// =============================================
// EXTERNAL API ENDPOINTS
// =============================================

export const EXTERNAL_APIS = {
  // OpenStreetMap API for address lookups
  OPENSTREETMAP: {
    BASE_URL: 'https://api.openstreetmap.org',
    REVERSE_GEOCODING: 'https://api.openstreetmap.org/reverse',
    
    // Helper function to build reverse geocoding URL
    getReverseGeocodingUrl: (lat: number, lon: number, zoom: number = 18) => 
      `${EXTERNAL_APIS.OPENSTREETMAP.REVERSE_GEOCODING}?format=json&lat=${lat}&lon=${lon}&zoom=${zoom}&addressdetails=1`
  },

  // Google Maps API
  GOOGLE_MAPS: {
    BASE_URL: 'https://www.google.com/maps',
    DIRECTIONS_BASE: 'https://www.google.com/maps/dir/',
    
    // Helper function to build directions URL
    getDirectionsUrl: (lat: number, lon: number) => 
      `${EXTERNAL_APIS.GOOGLE_MAPS.DIRECTIONS_BASE}?api=1&destination=${lat},${lon}`
  },

  // File storage endpoints
  STORAGE: {
    EXAMPLE_BASE: 'https://storage.example.com',
    
    // Helper function to build upload URL
    getUploadUrl: (fileName: string) => 
      `${EXTERNAL_APIS.STORAGE.EXAMPLE_BASE}/uploads/${fileName}`
  }
} as const

// =============================================
// DOCUMENTATION & HELP LINKS
// =============================================

export const DOCUMENTATION_LINKS = {
  // Supabase documentation
  SUPABASE: {
    MAIN: 'https://supabase.com',
    DOCS: 'https://supabase.com/docs',
    GITHUB: 'https://github.com/supabase/supabase'
  },

  // Project-specific documentation
  PROJECT: {
    HELP: '/help',
    FAQ: '/faq',
    SUPPORT: '/support'
  }
} as const

// =============================================
// WEBHOOK & CALLBACK URLS
// =============================================

export const WEBHOOK_ENDPOINTS = {
  // Internal webhooks
  INTERNAL: {
    JOB_STATUS_UPDATE: '/api/webhooks/job-status',
    STAGE_PROGRESSION: '/api/webhooks/stage-progression',
    NOTIFICATION: '/api/webhooks/notification'
  },

  // External service webhooks
  EXTERNAL: {
    PAYMENT_CALLBACK: '/api/webhooks/payment',
    SMS_CALLBACK: '/api/webhooks/sms',
    EMAIL_CALLBACK: '/api/webhooks/email'
  }
} as const

// =============================================
// HEALTH CHECK & STATUS ENDPOINTS
// =============================================

export const HEALTH_ENDPOINTS = {
  // Internal health checks
  API_HEALTH: '/api/health',
  DATABASE_HEALTH: '/api/health/database',
  STORAGE_HEALTH: '/api/health/storage',

  // External service status pages
  SUPABASE_STATUS: 'https://status.supabase.com',
  VERCEL_STATUS: 'https://www.vercel-status.com'
} as const

// =============================================
// ENVIRONMENT-SPECIFIC HELPERS
// =============================================

/**
 * Get Supabase URL with fallback
 */
export const getSupabaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_CONFIG.DEFAULT_URL
}

/**
 * Get Supabase anon key with fallback
 */
export const getSupabaseAnonKey = (): string => {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_CONFIG.DEFAULT_ANON_KEY
}

/**
 * Check if running in development mode
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if using demo/fallback configuration
 */
export const isUsingFallbackConfig = (): boolean => {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || 
         getSupabaseUrl() === SUPABASE_CONFIG.DEFAULT_URL
}

/**
 * Get base URL for the current environment
 */
export const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Client-side
    return window.location.origin
  }
  
  // Server-side
  return process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

/**
 * Build absolute URL from relative path
 */
export const buildAbsoluteUrl = (path: string): string => {
  const baseUrl = getBaseUrl()
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

// =============================================
// URL VALIDATION HELPERS
// =============================================

/**
 * Validate if URL is well-formed
 */
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

/**
 * Validate if URL is HTTPS (required for production)
 */
export const isHttpsUrl = (url: string): boolean => {
  try {
    const urlObj = new URL(url)
    return urlObj.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Ensure URL uses HTTPS in production
 */
export const ensureHttpsInProduction = (url: string): string => {
  if (isDevelopment()) {
    return url
  }
  
  if (!isHttpsUrl(url) && isValidUrl(url)) {
    try {
      const urlObj = new URL(url)
      urlObj.protocol = 'https:'
      return urlObj.toString()
    } catch {
      return url
    }
  }
  
  return url
}

// =============================================
// EXPORT GROUPED CONFIGURATIONS
// =============================================

export const ALL_ENDPOINTS = {
  SUPABASE_CONFIG,
  EXTERNAL_APIS,
  DOCUMENTATION_LINKS,
  WEBHOOK_ENDPOINTS,
  HEALTH_ENDPOINTS
} as const