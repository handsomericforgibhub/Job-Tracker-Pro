/**
 * Centralized Authentication and Authorization Middleware
 * 
 * This module provides secure, reusable authentication and authorization
 * functions for API routes to prevent unauthorized access and data breaches.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { UserRole } from '@/config/constants'

// Use anon key for user session validation (not service role key)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface AuthenticatedUser {
  id: string
  email: string
  role: UserRole
  company_id: string | null
}

export interface AuthenticationError extends Error {
  status: number
  code: string
}

/**
 * Creates an authentication error with proper status code
 */
function createAuthError(message: string, status: number, code: string): AuthenticationError {
  const error = new Error(message) as AuthenticationError
  error.status = status
  error.code = code
  return error
}

/**
 * Validates the Authorization header and extracts the JWT token
 */
function extractToken(request: NextRequest): string {
  const authHeader = request.headers.get('authorization')
  
  console.log('🔍 Auth middleware - extractToken:', {
    hasAuthHeader: !!authHeader,
    authHeaderPrefix: authHeader?.substring(0, 20) + '...' || 'none',
    allHeaders: Object.fromEntries(request.headers.entries())
  })
  
  if (!authHeader) {
    console.error('❌ Auth middleware: No authorization header provided')
    throw createAuthError('No authorization header provided', 401, 'NO_AUTH_HEADER')
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    console.error('❌ Auth middleware: Invalid authorization header format:', authHeader.substring(0, 50))
    throw createAuthError('Invalid authorization header format', 401, 'INVALID_AUTH_FORMAT')
  }
  
  const token = authHeader.replace('Bearer ', '').trim()
  
  if (!token) {
    console.error('❌ Auth middleware: No token provided in authorization header')
    throw createAuthError('No token provided in authorization header', 401, 'NO_TOKEN')
  }
  
  console.log('✅ Auth middleware: Token extracted successfully, length:', token.length)
  return token
}

/**
 * Validates JWT token and retrieves user information
 */
export async function validateAuth(request: NextRequest): Promise<AuthenticatedUser> {
  try {
    const token = extractToken(request)
    
    console.log('🔍 Auth middleware - validateAuth: Starting token validation')
    
    // Validate the JWT token with Supabase using the anon client
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    console.log('🔍 Auth middleware - validateAuth:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message
    })
    
    if (authError || !user) {
      console.error('❌ Auth middleware: Token validation failed:', authError?.message)
      throw createAuthError('Invalid or expired token', 401, 'INVALID_TOKEN')
    }
    
    // Get user profile from database
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('id, email, role, company_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !userProfile) {
      console.error('User profile fetch failed:', profileError?.message)
      throw createAuthError('User profile not found', 404, 'USER_NOT_FOUND')
    }
    
    return {
      id: userProfile.id,
      email: userProfile.email,
      role: userProfile.role as UserRole,
      company_id: userProfile.company_id
    }
    
  } catch (error) {
    if (error instanceof Error && 'status' in error) {
      throw error // Re-throw authentication errors as-is
    }
    
    console.error('Authentication validation error:', error)
    throw createAuthError('Authentication service error', 500, 'AUTH_SERVICE_ERROR')
  }
}

/**
 * Validates that the user has one of the allowed roles
 */
export async function validateRole(user: AuthenticatedUser, allowedRoles: UserRole[]): Promise<void> {
  if (!allowedRoles.includes(user.role)) {
    throw createAuthError(
      `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}. User role: ${user.role}`,
      403,
      'INSUFFICIENT_PERMISSIONS'
    )
  }
}

/**
 * Validates that the user can access the specified company's data
 */
export async function validateCompanyAccess(user: AuthenticatedUser, targetCompanyId: string): Promise<void> {
  // Site admins can access any company
  if (user.role === 'site_admin') {
    return
  }
  
  // Regular users can only access their own company
  if (!user.company_id || user.company_id !== targetCompanyId) {
    throw createAuthError(
      'Access denied. User can only access their own company data',
      403,
      'COMPANY_ACCESS_DENIED'
    )
  }
}

/**
 * Validates user authentication and role in one call
 */
export async function validateAuthAndRole(
  request: NextRequest, 
  allowedRoles: UserRole[]
): Promise<AuthenticatedUser> {
  const user = await validateAuth(request)
  await validateRole(user, allowedRoles)
  return user
}

/**
 * Validates authentication, role, and company access in one call
 */
export async function validateAuthRoleAndCompany(
  request: NextRequest,
  allowedRoles: UserRole[],
  targetCompanyId: string
): Promise<AuthenticatedUser> {
  const user = await validateAuth(request)
  await validateRole(user, allowedRoles)
  await validateCompanyAccess(user, targetCompanyId)
  return user
}

/**
 * Creates a standardized error response for authentication failures
 */
export function createAuthErrorResponse(error: AuthenticationError): NextResponse {
  const response = NextResponse.json(
    {
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    },
    { status: error.status }
  )
  
  // Add security headers
  response.headers.set('WWW-Authenticate', 'Bearer')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  
  return response
}

/**
 * Middleware wrapper that handles authentication errors automatically
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>,
  allowedRoles?: UserRole[]
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      let user: AuthenticatedUser
      
      if (allowedRoles) {
        user = await validateAuthAndRole(request, allowedRoles)
      } else {
        user = await validateAuth(request)
      }
      
      return await handler(request, user, ...args)
      
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        return createAuthErrorResponse(error as AuthenticationError)
      }
      
      console.error('Unexpected error in auth middleware:', error)
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware wrapper for company-scoped operations
 */
export function withCompanyAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<NextResponse>,
  allowedRoles: UserRole[],
  getCompanyId: (request: NextRequest, ...args: T) => string
) {
  return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      const user = await validateAuthAndRole(request, allowedRoles)
      const targetCompanyId = getCompanyId(request, ...args)
      
      await validateCompanyAccess(user, targetCompanyId)
      
      return await handler(request, user, ...args)
      
    } catch (error) {
      if (error instanceof Error && 'status' in error) {
        return createAuthErrorResponse(error as AuthenticationError)
      }
      
      console.error('Unexpected error in company auth middleware:', error)
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      )
    }
  }
}

/**
 * Utility function to get effective company ID for site admins with context
 */
export function getEffectiveCompanyId(user: AuthenticatedUser, requestCompanyId?: string | null): string {
  if (user.role === 'site_admin') {
    if (!requestCompanyId) {
      throw createAuthError(
        'Site admin must specify company_id in request',
        400,
        'COMPANY_ID_REQUIRED'
      )
    }
    return requestCompanyId
  }
  
  if (!user.company_id) {
    throw createAuthError(
      'User does not belong to any company',
      400,
      'NO_COMPANY_MEMBERSHIP'
    )
  }
  
  return user.company_id
}

/**
 * Rate limiting helper (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000): void {
  const now = Date.now()
  const key = identifier
  
  const current = rateLimitMap.get(key)
  
  if (!current || now > current.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return
  }
  
  if (current.count >= maxRequests) {
    throw createAuthError(
      'Rate limit exceeded. Too many requests.',
      429,
      'RATE_LIMIT_EXCEEDED'
    )
  }
  
  current.count++
}