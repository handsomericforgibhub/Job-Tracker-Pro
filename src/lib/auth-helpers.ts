/**
 * Authentication Helper Functions
 * 
 * ADR Phase 1: API Security and Authentication Standardization
 * ADR Phase 3: Enhanced Error Handling and Logging Integration
 * This module provides consistent authentication utilities for API routes
 * ensuring proper company access verification and user role validation.
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from './supabase';
import { 
  AuthenticationError, 
  AuthorizationError, 
  errorLogger, 
  extractRequestContext,
  withPerformanceMonitoring 
} from './error-handler';

// =============================================
// Type Definitions
// =============================================

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'site_admin' | 'company_admin' | 'foreman' | 'worker';
  company_id: string | null;
  full_name: string | null;
  is_site_admin: boolean;
}

export interface AuthenticationResult {
  user: AuthenticatedUser | null;
  error: string | null;
  response?: NextResponse;
}

export interface CompanyAccessResult {
  hasAccess: boolean;
  user: AuthenticatedUser;
  error?: string;
}

// =============================================
// Core Authentication Functions
// =============================================

/**
 * Authenticates the current user from the request
 * Returns user data or null if not authenticated
 */
export async function authenticateUser(request?: NextRequest): Promise<AuthenticationResult> {
  try {
    const supabaseClient = createRouteHandlerClient({ cookies });
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return {
        user: null,
        error: 'Unauthorized - No valid session',
        response: NextResponse.json(
          { error: 'Unauthorized', message: 'Please log in to access this resource' }, 
          { status: 401 }
        )
      };
    }

    // Get additional user details from the users table
    const { data: userData, error: userError } = await supabaseClient
      .from('users')
      .select('id, email, role, company_id, full_name')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return {
        user: null,
        error: 'User data not found',
        response: NextResponse.json(
          { error: 'User data not found', message: 'User profile is incomplete' }, 
          { status: 404 }
        )
      };
    }

    const authenticatedUser: AuthenticatedUser = {
      id: userData.id,
      email: userData.email,
      role: userData.role,
      company_id: userData.company_id,
      full_name: userData.full_name,
      is_site_admin: userData.role === 'site_admin'
    };

    return {
      user: authenticatedUser,
      error: null
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      user: null,
      error: 'Authentication failed',
      response: NextResponse.json(
        { error: 'Internal server error', message: 'Authentication failed' }, 
        { status: 500 }
      )
    };
  }
}

/**
 * Checks if the authenticated user has access to a specific company
 * Site admins have access to all companies
 */
export async function hasCompanyAccess(
  user: AuthenticatedUser,
  targetCompanyId: string | null
): Promise<boolean> {
  // Site admins have access to all companies
  if (user.is_site_admin) {
    return true;
  }

  // If no target company specified, allow access
  if (!targetCompanyId) {
    return true;
  }

  // Regular users can only access their own company
  return user.company_id === targetCompanyId;
}

/**
 * Validates company access for API routes
 * Returns authentication result with company access validation
 */
export async function validateCompanyAccess(
  request: NextRequest,
  targetCompanyId?: string | null
): Promise<CompanyAccessResult> {
  // First authenticate the user
  const authResult = await authenticateUser(request);
  
  if (!authResult.user) {
    return {
      hasAccess: false,
      user: null as any,
      error: authResult.error || 'Authentication failed'
    };
  }

  // If no target company specified, get it from query params or request body
  let companyId = targetCompanyId;
  
  if (!companyId) {
    // Try to get company_id from query parameters
    const url = new URL(request.url);
    companyId = url.searchParams.get('company_id');
    
    // If still not found, try to get from request body
    if (!companyId && (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH')) {
      try {
        const body = await request.clone().json();
        companyId = body.company_id;
      } catch {
        // Body parsing failed, continue without company_id
      }
    }
  }

  // Check access
  const accessGranted = await hasCompanyAccess(authResult.user, companyId);

  if (!accessGranted) {
    return {
      hasAccess: false,
      user: authResult.user,
      error: `Access denied - You don't have permission to access resources for company: ${companyId}`
    };
  }

  return {
    hasAccess: true,
    user: authResult.user
  };
}

// =============================================
// Role-Based Access Control
// =============================================

/**
 * Checks if user has a specific role or higher
 */
export function hasRole(user: AuthenticatedUser, requiredRole: AuthenticatedUser['role']): boolean {
  const roleHierarchy = {
    'worker': 1,
    'foreman': 2,
    'company_admin': 3,
    'site_admin': 4
  };

  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}

/**
 * Checks if user has admin privileges (company_admin or site_admin)
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'company_admin' || user.role === 'site_admin';
}

/**
 * Checks if user can modify a specific resource
 * Site admins can modify anything, company admins can modify their company's resources
 */
export function canModifyResource(
  user: AuthenticatedUser,
  resourceCompanyId: string | null
): boolean {
  if (user.is_site_admin) {
    return true;
  }

  if (user.role === 'company_admin' && user.company_id === resourceCompanyId) {
    return true;
  }

  return false;
}

// =============================================
// API Route Helpers
// =============================================

/**
 * Standard authentication middleware for API routes
 * Use this at the beginning of API route handlers
 */
export async function requireAuthentication(request: NextRequest): Promise<{
  user: AuthenticatedUser;
  error?: NextResponse;
}> {
  const authResult = await authenticateUser(request);
  
  if (!authResult.user) {
    return {
      user: null as any,
      error: authResult.response || NextResponse.json(
        { error: 'Authentication required' }, 
        { status: 401 }
      )
    };
  }

  return { user: authResult.user };
}

/**
 * Requires company access for API routes
 * Use this for routes that operate on company-scoped resources
 */
export async function requireCompanyAccess(
  request: NextRequest,
  targetCompanyId?: string | null
): Promise<{
  user: AuthenticatedUser;
  error?: NextResponse;
}> {
  const accessResult = await validateCompanyAccess(request, targetCompanyId);
  
  if (!accessResult.hasAccess) {
    return {
      user: null as any,
      error: NextResponse.json(
        { 
          error: 'Access denied', 
          message: accessResult.error || 'You don\'t have permission to access this resource'
        }, 
        { status: 403 }
      )
    };
  }

  return { user: accessResult.user };
}

/**
 * Requires admin role for API routes
 */
export async function requireAdminAccess(request: NextRequest): Promise<{
  user: AuthenticatedUser;
  error?: NextResponse;
}> {
  const authResult = await requireAuthentication(request);
  
  if (authResult.error) {
    return authResult;
  }

  if (!isAdmin(authResult.user)) {
    return {
      user: null as any,
      error: NextResponse.json(
        { 
          error: 'Admin access required', 
          message: 'You must be an administrator to access this resource'
        }, 
        { status: 403 }
      )
    };
  }

  return { user: authResult.user };
}

/**
 * Requires site admin role for API routes
 */
export async function requireSiteAdminAccess(request: NextRequest): Promise<{
  user: AuthenticatedUser;
  error?: NextResponse;
}> {
  const authResult = await requireAuthentication(request);
  
  if (authResult.error) {
    return authResult;
  }

  if (!authResult.user.is_site_admin) {
    return {
      user: null as any,
      error: NextResponse.json(
        { 
          error: 'Site admin access required', 
          message: 'You must be a site administrator to access this resource'
        }, 
        { status: 403 }
      )
    };
  }

  return { user: authResult.user };
}

// =============================================
// Utility Functions
// =============================================

/**
 * Gets user's company ID, ensuring they have access to it
 */
export function getUserCompanyId(user: AuthenticatedUser): string | null {
  return user.company_id;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  message: string, 
  status: number = 400, 
  code?: string
): NextResponse {
  return NextResponse.json(
    { 
      error: message,
      code: code,
      timestamp: new Date().toISOString()
    }, 
    { status }
  );
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(
  data: T, 
  message?: string, 
  status: number = 200
): NextResponse {
  return NextResponse.json(
    { 
      data,
      message,
      success: true,
      timestamp: new Date().toISOString()
    }, 
    { status }
  );
}

/**
 * Logs API access for security monitoring
 */
export function logApiAccess(
  request: NextRequest,
  user: AuthenticatedUser | null,
  action: string,
  success: boolean,
  error?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    userId: user?.id,
    userRole: user?.role,
    companyId: user?.company_id,
    action,
    success,
    error,
    ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  };

  // In production, you would send this to a logging service
  if (process.env.NODE_ENV === 'development') {
    console.log('API Access Log:', JSON.stringify(logEntry, null, 2));
  }

  // TODO: Integrate with actual logging service (e.g., Winston, Pino, or external service)
}

// =============================================
// Development Helpers
// =============================================

/**
 * Validates that all authentication functions are working correctly
 * Only available in development mode
 */
export async function validateAuthSetup(): Promise<boolean> {
  if (process.env.NODE_ENV !== 'development') {
    return true;
  }

  try {
    // Test database connection
    const { error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }

    console.log('✅ Authentication setup validation passed');
    return true;
  } catch (error) {
    console.error('❌ Authentication setup validation failed:', error);
    return false;
  }
}

/**
 * Returns authentication configuration summary for debugging
 */
export function getAuthConfigSummary(): object {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) + '...',
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString()
  };
}