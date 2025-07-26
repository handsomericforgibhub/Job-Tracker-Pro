-- ADR Phase 1: Example of Standardized API Authentication
-- Purpose: Documentation and example of how to update API routes
-- This file shows the before/after pattern for API route authentication

/*
BEFORE (Non-compliant):
========================

// src/app/api/jobs/route.ts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    
    // No authentication check!
    // Direct database query without user verification
    let query = supabase
      .from('jobs')
      .select('*')
      .eq('company_id', company_id) // Trusts client-provided company_id
    
    const { data: jobs, error } = await query
    return NextResponse.json(jobs)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

AFTER (ADR-compliant):
======================

// src/app/api/jobs/route.ts
import { requireCompanyAccess, createSuccessResponse, createErrorResponse, logApiAccess } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate user and validate company access
    const { user, error } = await requireCompanyAccess(request)
    
    if (error) {
      logApiAccess(request, null, 'fetch_jobs', false, 'Authentication failed')
      return error
    }

    // 2. Use authenticated user's company_id (don't trust client)
    const company_id = user.company_id
    
    // 3. Query with proper RLS (user context automatically applied)
    const { data: jobs, error: dbError } = await supabase
      .from('jobs')
      .select(`
        *,
        foreman:users!jobs_foreman_id_fkey(id, full_name, email),
        current_stage:job_stages!current_stage_id(*)
      `)
      .eq('company_id', company_id) // Now using verified company_id
      .order('created_at', { ascending: false })

    if (dbError) {
      logApiAccess(request, user, 'fetch_jobs', false, dbError.message)
      return createErrorResponse('Failed to fetch jobs', 500)
    }

    // 4. Log successful access and return standardized response
    logApiAccess(request, user, 'fetch_jobs', true)
    return createSuccessResponse(jobs, `Found ${jobs.length} jobs`)
  } catch (error) {
    logApiAccess(request, null, 'fetch_jobs', false, error.message)
    return createErrorResponse('Internal server error', 500)
  }
}

KEY IMPROVEMENTS:
================

1. AUTHENTICATION REQUIRED
   - Before: Anyone could access any company's data
   - After: Must be authenticated user with valid session

2. COMPANY ACCESS VALIDATION  
   - Before: Trusts client-provided company_id parameter
   - After: Uses authenticated user's company_id, validates access

3. PROPER ERROR HANDLING
   - Before: Generic error responses
   - After: Standardized error responses with proper HTTP codes

4. SECURITY LOGGING
   - Before: No audit trail
   - After: All access attempts logged for security monitoring

5. RLS ENFORCEMENT
   - Before: Manual company_id filtering
   - After: Database RLS policies automatically enforce data isolation

6. CONSISTENT PATTERNS
   - Before: Each route implements auth differently
   - After: Standardized auth helpers used across all routes

MIGRATION CHECKLIST:
===================

For each API route file:

□ Import auth helpers: requireCompanyAccess, createSuccessResponse, createErrorResponse, logApiAccess
□ Replace manual auth checks with requireCompanyAccess() call
□ Remove client-provided company_id, use user.company_id instead  
□ Replace manual error responses with createErrorResponse()
□ Replace manual success responses with createSuccessResponse()
□ Add logApiAccess() calls for security monitoring
□ Test that RLS policies work correctly
□ Verify proper error handling for all failure cases

PRIORITY ORDER FOR MIGRATION:
=============================

1. HIGH PRIORITY (Security Critical):
   - /api/jobs/* - Job management
   - /api/users/* - User management  
   - /api/companies/* - Company data
   - /api/admin/* - Administrative functions

2. MEDIUM PRIORITY (Business Logic):
   - /api/projects/* - Project management
   - /api/tasks/* - Task management
   - /api/time/* - Time tracking
   - /api/documents/* - Document management

3. LOW PRIORITY (Support Functions):
   - /api/analytics/* - Reporting
   - /api/stages/* - Configuration
   - /api/test-* - Development/testing routes

*/

-- This is a documentation script, no SQL to execute
SELECT 'Standardized API authentication pattern documented - see file comments for implementation guide' as status;