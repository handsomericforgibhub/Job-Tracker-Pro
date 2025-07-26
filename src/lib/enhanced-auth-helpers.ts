/**
 * Enhanced Authentication Helper Functions
 * 
 * ADR Phase 3: Infrastructure & Optimization
 * Enhanced auth helpers with comprehensive error handling, logging,
 * and performance monitoring for the multi-tenant JobTracker application.
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from './supabase';
import { 
  AuthenticationError, 
  AuthorizationError, 
  DatabaseError,
  BusinessLogicError,
  errorLogger, 
  extractRequestContext,
  withPerformanceMonitoring,
  ErrorContext 
} from './error-handler';

// =============================================
// Enhanced Type Definitions
// =============================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'site_admin' | 'owner' | 'admin' | 'foreman' | 'worker' | 'client';
  company_id: string | null;
  full_name: string | null;
  is_site_admin: boolean;
  is_active: boolean;
  last_login_at: string | null;
  permissions: string[];  // Role-based permissions
}

export interface AuthenticationResult {
  user: AuthenticatedUser | null;
  error: NextResponse | null;
  context: ErrorContext;
}

export interface CompanyAccessResult {
  hasAccess: boolean;
  user: AuthenticatedUser;
  error?: NextResponse;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    retryable: boolean;
    id?: string;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    processingTime: number;
  };
}

// =============================================
// Core Authentication Functions (Enhanced)
// =============================================

/**
 * Create route handler client with enhanced error handling
 */
function createRouteHandlerClient() {
  try {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookies().set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
  } catch (error) {
    throw new DatabaseError('Failed to create Supabase client', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Enhanced user authentication with performance monitoring
 */
export const authenticateUser = withPerformanceMonitoring(
  async (request?: NextRequest): Promise<AuthenticationResult> => {
    const context = request ? extractRequestContext(request) : {}
    
    try {
      const supabaseClient = createRouteHandlerClient()
      
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
      
      if (authError || !user) {
        const error = new AuthenticationError(
          authError?.message || 'No authenticated user found',
          { ...context, authError: authError?.message }
        )
        
        await errorLogger.logError(error, context)
        
        return {
          user: null,
          error: new NextResponse(
            JSON.stringify({
              success: false,
              error: {
                message: error.userFriendlyMessage,
                code: error.code,
                retryable: error.retryable,
                id: error.id
              }
            }),
            { 
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            }
          ),
          context
        }
      }

      // Fetch user profile with role and company information
      const { data: userProfile, error: profileError } = await supabaseClient
        .from('users')
        .select(`
          id,
          email,
          full_name,
          role,
          company_id,
          is_site_admin,
          is_active,
          last_login_at
        `)
        .eq('id', user.id)
        .single()

      if (profileError || !userProfile) {
        const error = new DatabaseError(
          'Failed to fetch user profile',
          { ...context, userId: user.id, profileError: profileError?.message }
        )
        
        await errorLogger.logError(error, context)
        
        return {
          user: null,
          error: new NextResponse(
            JSON.stringify({
              success: false,
              error: {
                message: 'User profile not found',
                code: 'PROFILE_NOT_FOUND',
                retryable: false
              }
            }),
            { 
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            }
          ),
          context
        }
      }

      // Check if user is active
      if (!userProfile.is_active) {
        const error = new AuthorizationError(
          'User account is inactive',
          { ...context, userId: user.id }
        )
        
        await errorLogger.logError(error, context)
        
        return {
          user: null,
          error: new NextResponse(
            JSON.stringify({
              success: false,
              error: {
                message: 'Your account has been deactivated. Please contact your administrator.',
                code: 'ACCOUNT_INACTIVE',
                retryable: false
              }
            }),
            { 
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          ),
          context
        }
      }

      // Get role-based permissions
      const permissions = getRolePermissions(userProfile.role)

      const authenticatedUser: AuthenticatedUser = {
        id: userProfile.id,
        email: userProfile.email,
        role: userProfile.role,
        company_id: userProfile.company_id,
        full_name: userProfile.full_name,
        is_site_admin: userProfile.is_site_admin || false,
        is_active: userProfile.is_active,
        last_login_at: userProfile.last_login_at,
        permissions
      }

      // Update last login timestamp
      await supabaseClient
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id)

      return {
        user: authenticatedUser,
        error: null,
        context: { ...context, userId: user.id, companyId: userProfile.company_id }
      }

    } catch (error) {
      await errorLogger.logError(error as Error, context)
      
      return {
        user: null,
        error: new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              message: 'Authentication failed',
              code: 'AUTH_ERROR',
              retryable: true
            }
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        ),
        context
      }
    }
  },
  'authenticate_user',
  1000
)

/**
 * Enhanced company access verification
 */
export const requireCompanyAccess = withPerformanceMonitoring(
  async (request: NextRequest, companyId?: string): Promise<AuthenticationResult> => {
    const authResult = await authenticateUser(request)
    
    if (authResult.error || !authResult.user) {
      return authResult
    }

    const { user } = authResult
    const context = { ...authResult.context, requestedCompanyId: companyId }

    try {
      // Site admins have access to all companies
      if (user.is_site_admin) {
        return { user, error: null, context }
      }

      // If no specific company requested, user must have a company
      if (!companyId) {
        if (!user.company_id) {
          const error = new AuthorizationError(
            'User does not belong to any company',
            context
          )
          
          await errorLogger.logError(error, context)
          
          return {
            user: null,
            error: new NextResponse(
              JSON.stringify({
                success: false,
                error: {
                  message: 'Company association required',
                  code: 'NO_COMPANY_ACCESS',
                  retryable: false
                }
              }),
              { 
                status: 403,
                headers: { 'Content-Type': 'application/json' }
              }
            ),
            context
          }
        }
        
        return { user, error: null, context }
      }

      // Check if user has access to the requested company
      if (user.company_id !== companyId) {
        const error = new AuthorizationError(
          `User does not have access to company ${companyId}`,
          context
        )
        
        await errorLogger.logError(error, context)
        
        return {
          user: null,
          error: new NextResponse(
            JSON.stringify({
              success: false,
              error: {
                message: 'Access denied to this company',
                code: 'COMPANY_ACCESS_DENIED',
                retryable: false
              }
            }),
            { 
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          ),
          context
        }
      }

      return { user, error: null, context }

    } catch (error) {
      await errorLogger.logError(error as Error, context)
      
      return {
        user: null,
        error: new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              message: 'Company access verification failed',
              code: 'COMPANY_ACCESS_ERROR',
              retryable: true
            }
          }),
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        ),
        context
      }
    }
  },
  'require_company_access',
  800
)

/**
 * Require admin access (company admin or site admin)
 */
export const requireAdminAccess = withPerformanceMonitoring(
  async (request: NextRequest, companyId?: string): Promise<AuthenticationResult> => {
    const authResult = await requireCompanyAccess(request, companyId)
    
    if (authResult.error || !authResult.user) {
      return authResult
    }

    const { user } = authResult
    const context = authResult.context

    // Check if user has admin privileges
    if (!user.is_site_admin && !['owner', 'admin'].includes(user.role)) {
      const error = new AuthorizationError(
        'Admin access required',
        { ...context, userRole: user.role }
      )
      
      await errorLogger.logError(error, context)
      
      return {
        user: null,
        error: new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              message: 'Administrator privileges required',
              code: 'ADMIN_ACCESS_REQUIRED',
              retryable: false
            }
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        ),
        context
      }
    }

    return { user, error: null, context }
  },
  'require_admin_access',
  600
)

/**
 * Require site admin access
 */
export const requireSiteAdminAccess = withPerformanceMonitoring(
  async (request: NextRequest): Promise<AuthenticationResult> => {
    const authResult = await authenticateUser(request)
    
    if (authResult.error || !authResult.user) {
      return authResult
    }

    const { user } = authResult
    const context = authResult.context

    if (!user.is_site_admin) {
      const error = new AuthorizationError(
        'Site admin access required',
        { ...context, userRole: user.role }
      )
      
      await errorLogger.logError(error, context)
      
      return {
        user: null,
        error: new NextResponse(
          JSON.stringify({
            success: false,
            error: {
              message: 'Site administrator privileges required',
              code: 'SITE_ADMIN_ACCESS_REQUIRED',
              retryable: false
            }
          }),
          { 
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        ),
        context
      }
    }

    return { user, error: null, context }
  },
  'require_site_admin_access',
  500
)

// =============================================
// Role-Based Access Control
// =============================================

/**
 * Get permissions for a user role
 */
function getRolePermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    site_admin: [
      'manage_all_companies',
      'manage_all_users',
      'view_system_logs',
      'manage_system_settings'
    ],
    owner: [
      'manage_company',
      'manage_all_users',
      'manage_jobs',
      'manage_workers',
      'view_reports',
      'manage_settings'
    ],
    admin: [
      'manage_jobs',
      'manage_workers',
      'assign_tasks',
      'view_reports',
      'manage_time_entries'
    ],
    foreman: [
      'manage_assigned_jobs',
      'assign_tasks',
      'manage_time_entries',
      'view_job_reports'
    ],
    worker: [
      'view_assigned_jobs',
      'update_task_status',
      'manage_own_time_entries'
    ],
    client: [
      'view_own_jobs',
      'submit_feedback',
      'view_job_progress'
    ]
  }

  return permissions[role] || []
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  return user.permissions.includes(permission)
}

/**
 * Require specific permission
 */
export async function requirePermission(
  request: NextRequest,
  permission: string,
  companyId?: string
): Promise<AuthenticationResult> {
  const authResult = await requireCompanyAccess(request, companyId)
  
  if (authResult.error || !authResult.user) {
    return authResult
  }

  const { user } = authResult
  const context = authResult.context

  if (!hasPermission(user, permission)) {
    const error = new AuthorizationError(
      `Permission '${permission}' required`,
      { ...context, requiredPermission: permission, userPermissions: user.permissions }
    )
    
    await errorLogger.logError(error, context)
    
    return {
      user: null,
      error: new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'PERMISSION_DENIED',
            retryable: false
          }
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      ),
      context
    }
  }

  return { user, error: null, context }
}

// =============================================
// API Response Utilities
// =============================================

/**
 * Create standardized success response
 */
export function createSuccessResponse<T>(
  data: T,
  message?: string,
  metadata?: Record<string, any>
): NextResponse {
  const response: ApiResponse<T> = {
    success: true,
    data,
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      processingTime: 0, // Will be set by performance monitoring
      ...metadata
    }
  }

  if (message) {
    response.metadata!.message = message
  }

  return NextResponse.json(response)
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  statusCode: number = 500,
  code?: string,
  retryable: boolean = false,
  errorId?: string
): NextResponse {
  const response: ApiResponse = {
    success: false,
    error: {
      message,
      code: code || 'INTERNAL_ERROR',
      retryable,
      id: errorId
    },
    metadata: {
      requestId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      processingTime: 0
    }
  }

  return NextResponse.json(response, { status: statusCode })
}

/**
 * Log API access for security monitoring
 */
export async function logApiAccess(
  request: NextRequest,
  user: AuthenticatedUser | null,
  action: string,
  success: boolean,
  details?: string
): Promise<void> {
  try {
    const context = extractRequestContext(request)
    
    await supabase
      .from('audit_logs')
      .insert({
        company_id: user?.company_id,
        user_id: user?.id,
        action: success ? 'API_ACCESS' : 'API_ACCESS_FAILED',
        table_name: 'api_access',
        new_values: {
          action,
          success,
          details,
          url: context.url,
          method: context.method,
          user_agent: context.userAgent,
          ip_address: context.ipAddress
        },
        ip_address: context.ipAddress,
        user_agent: context.userAgent
      })
  } catch (error) {
    // Log to error handler but don't throw
    await errorLogger.logError(error as Error, { 
      context: 'api_access_logging',
      action,
      success 
    })
  }
}

// =============================================
// Business Logic Helpers
// =============================================

/**
 * Check if user can access specific company
 */
export function hasCompanyAccess(user: AuthenticatedUser, companyId: string): boolean {
  return user.is_site_admin || user.company_id === companyId
}

/**
 * Check if user is admin
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.is_site_admin || ['owner', 'admin'].includes(user.role)
}

/**
 * Check if user is site admin
 */
export function isSiteAdmin(user: AuthenticatedUser): boolean {
  return user.is_site_admin
}

/**
 * Validate business rule with error handling
 */
export async function validateBusinessRule(
  condition: boolean,
  message: string,
  context: ErrorContext = {}
): Promise<void> {
  if (!condition) {
    const error = new BusinessLogicError(message, context, message)
    await errorLogger.logError(error, context)
    throw error
  }
}