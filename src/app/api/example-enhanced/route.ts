/**
 * Enhanced API Route Example
 * 
 * ADR Phase 3: Infrastructure & Optimization
 * This demonstrates the complete implementation of:
 * - Enhanced error handling and logging
 * - Performance monitoring
 * - Comprehensive authentication
 * - Business rule validation
 * - Standardized responses
 */

import { NextRequest } from 'next/server'
import { 
  requireCompanyAccess,
  createSuccessResponse,
  logApiAccess,
  hasPermission
} from '@/lib/enhanced-auth-helpers'
import { 
  performanceMonitor,
  MetricType,
  withPerformanceMonitoring,
  monitoredSupabaseQuery
} from '@/lib/performance-monitor'
import { 
  DatabaseError,
  ValidationError,
  BusinessLogicError,
  handleApiError,
  validateBusinessRule
} from '@/lib/error-handler'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

// =============================================
// Request/Response Schemas
// =============================================

const CreateJobSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  project_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  client_name: z.string().min(1, 'Client name is required'),
  client_email: z.string().email('Invalid email format').optional(),
  scheduled_start_date: z.string().datetime().optional(),
  estimated_cost: z.number().min(0, 'Cost must be positive').optional()
})

const UpdateJobSchema = CreateJobSchema.partial()

// =============================================
// GET /api/example-enhanced
// Get jobs with enhanced monitoring and error handling
// =============================================

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  let user = null

  try {
    // 1. Authentication and authorization with performance monitoring
    const authResult = await requireCompanyAccess(request)
    if (authResult.error) {
      return authResult.error
    }
    
    user = authResult.user
    const context = authResult.context

    // 2. Check permissions
    if (!hasPermission(user, 'view_jobs')) {
      await logApiAccess(request, user, 'GET /api/jobs', false, 'Insufficient permissions')
      return createErrorResponse('Insufficient permissions', 403, 'PERMISSION_DENIED')
    }

    // 3. Parse query parameters with validation
    const url = new URL(request.url)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')))
    const status = url.searchParams.get('status')
    const priority = url.searchParams.get('priority')

    // 4. Validate query parameters
    if (status && !['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(status)) {
      throw new ValidationError('Invalid status parameter', context)
    }

    if (priority && !['low', 'medium', 'high', 'urgent'].includes(priority)) {
      throw new ValidationError('Invalid priority parameter', context)
    }

    // 5. Business rule validation
    await validateBusinessRule(
      limit <= 100,
      'Cannot request more than 100 jobs at once',
      { ...context, requestedLimit: limit }
    )

    // 6. Build query with performance monitoring
    const offset = (page - 1) * limit
    let queryBuilder = supabase
      .from('jobs')
      .select(`
        id,
        title,
        description,
        status,
        priority,
        client_name,
        client_email,
        scheduled_start_date,
        estimated_cost,
        actual_cost,
        created_at,
        updated_at,
        projects (
          id,
          name,
          client_name
        )
      `)
      .eq('company_id', user.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (status) {
      queryBuilder = queryBuilder.eq('status', status)
    }
    if (priority) {
      queryBuilder = queryBuilder.eq('priority', priority)
    }

    // 7. Execute query with monitoring
    const jobs = await monitoredSupabaseQuery(
      queryBuilder,
      'get_jobs_paginated',
      {
        company_id: user.company_id,
        user_id: user.id,
        url: request.url,
        method: request.method,
        metadata: {
          page,
          limit,
          status,
          priority,
          filters_applied: !!(status || priority)
        }
      }
    )

    // 8. Get total count for pagination
    let countQueryBuilder = supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)

    if (status) {
      countQueryBuilder = countQueryBuilder.eq('status', status)
    }
    if (priority) {
      countQueryBuilder = countQueryBuilder.eq('priority', priority)
    }

    const { count: totalCount } = await monitoredSupabaseQuery(
      countQueryBuilder,
      'count_jobs',
      { company_id: user.company_id, user_id: user.id }
    )

    // 9. Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // 10. Record successful API access
    await logApiAccess(request, user, 'GET /api/jobs', true, `Retrieved ${jobs.length} jobs`)

    // 11. Record performance metric
    await performanceMonitor.recordMetric({
      company_id: user.company_id,
      metric_type: MetricType.API_RESPONSE_TIME,
      metric_name: 'get_jobs',
      operation_name: 'GET /api/jobs',
      duration_ms: Date.now() - startTime,
      url: request.url,
      method: request.method,
      user_id: user.id,
      metadata: {
        jobs_count: jobs.length,
        total_count: totalCount,
        page,
        limit,
        has_filters: !!(status || priority)
      }
    })

    // 12. Return success response
    return createSuccessResponse(
      {
        jobs,
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next_page: hasNextPage,
          has_previous_page: hasPreviousPage
        }
      },
      `Retrieved ${jobs.length} jobs successfully`,
      {
        query_duration_ms: Date.now() - startTime,
        cache_hit: false
      }
    )

  } catch (error) {
    // Enhanced error handling with context
    return await handleApiError(error as Error, request, {
      operation: 'GET /api/jobs',
      user_id: user?.id,
      company_id: user?.company_id,
      duration_ms: Date.now() - startTime
    })
  }
}

// =============================================
// POST /api/example-enhanced
// Create job with comprehensive validation and monitoring
// =============================================

export const POST = withPerformanceMonitoring(
  async (request: NextRequest) => {
    let user = null

    try {
      // 1. Authentication and authorization
      const authResult = await requireCompanyAccess(request)
      if (authResult.error) {
        return authResult.error
      }
      
      user = authResult.user
      const context = authResult.context

      // 2. Check permissions
      if (!hasPermission(user, 'manage_jobs')) {
        await logApiAccess(request, user, 'POST /api/jobs', false, 'Insufficient permissions')
        return createErrorResponse('Insufficient permissions', 403, 'PERMISSION_DENIED')
      }

      // 3. Parse and validate request body
      const body = await request.json()
      const validationResult = CreateJobSchema.safeParse(body)
      
      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        throw new ValidationError(
          `Validation failed: ${errors.join(', ')}`,
          { ...context, validationErrors: errors }
        )
      }

      const jobData = validationResult.data

      // 4. Business rule validations
      if (jobData.project_id) {
        // Verify project exists and user has access
        const project = await monitoredSupabaseQuery(
          supabase
            .from('projects')
            .select('id, company_id')
            .eq('id', jobData.project_id)
            .single(),
          'verify_project_access',
          { project_id: jobData.project_id, user_id: user.id }
        )

        await validateBusinessRule(
          project && project.company_id === user.company_id,
          'Project not found or access denied',
          { ...context, project_id: jobData.project_id }
        )
      }

      // Check for duplicate job titles within the same company
      const existingJob = await monitoredSupabaseQuery(
        supabase
          .from('jobs')
          .select('id')
          .eq('company_id', user.company_id)
          .eq('title', jobData.title)
          .maybeSingle(),
        'check_duplicate_job_title',
        { title: jobData.title, company_id: user.company_id }
      )

      if (existingJob) {
        throw new BusinessLogicError(
          'A job with this title already exists',
          context,
          'Job title must be unique within your company'
        )
      }

      // 5. Create job with audit trail
      const newJob = await monitoredSupabaseQuery(
        supabase
          .from('jobs')
          .insert({
            ...jobData,
            company_id: user.company_id,
            created_by: user.id,
            status: 'planning'
          })
          .select(`
            id,
            title,
            description,
            status,
            priority,
            client_name,
            client_email,
            scheduled_start_date,
            estimated_cost,
            created_at,
            projects (
              id,
              name
            )
          `)
          .single(),
        'create_job',
        {
          company_id: user.company_id,
          user_id: user.id,
          job_title: jobData.title
        }
      )

      // 6. Log successful creation
      await logApiAccess(request, user, 'POST /api/jobs', true, `Created job: ${newJob.title}`)

      // 7. Return success response
      return createSuccessResponse(
        newJob,
        'Job created successfully',
        {
          job_id: newJob.id,
          created_by: user.id
        }
      )

    } catch (error) {
      // Enhanced error handling
      await logApiAccess(request, user, 'POST /api/jobs', false, (error as Error).message)
      
      return await handleApiError(error as Error, request, {
        operation: 'POST /api/jobs',
        user_id: user?.id,
        company_id: user?.company_id
      })
    }
  },
  MetricType.API_RESPONSE_TIME,
  'create_job_api',
  'POST /api/jobs'
)

// =============================================
// PUT /api/example-enhanced/[id]
// Update job with optimistic locking and conflict resolution
// =============================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let user = null

  try {
    // 1. Validate job ID parameter
    const jobId = params.id
    if (!jobId || typeof jobId !== 'string') {
      throw new ValidationError('Invalid job ID parameter')
    }

    // 2. Authentication and authorization
    const authResult = await requireCompanyAccess(request)
    if (authResult.error) {
      return authResult.error
    }
    
    user = authResult.user
    const context = { ...authResult.context, job_id: jobId }

    // 3. Check permissions
    if (!hasPermission(user, 'manage_jobs')) {
      await logApiAccess(request, user, 'PUT /api/jobs', false, 'Insufficient permissions')
      return createErrorResponse('Insufficient permissions', 403, 'PERMISSION_DENIED')
    }

    // 4. Parse and validate request body
    const body = await request.json()
    const validationResult = UpdateJobSchema.safeParse(body)
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      throw new ValidationError(
        `Validation failed: ${errors.join(', ')}`,
        { ...context, validationErrors: errors }
      )
    }

    const updateData = validationResult.data

    // 5. Verify job exists and user has access
    const existingJob = await monitoredSupabaseQuery(
      supabase
        .from('jobs')
        .select('id, company_id, status, updated_at')
        .eq('id', jobId)
        .single(),
      'verify_job_access',
      { job_id: jobId, user_id: user.id }
    )

    await validateBusinessRule(
      existingJob && existingJob.company_id === user.company_id,
      'Job not found or access denied',
      context
    )

    // 6. Business rule: Can't modify completed or cancelled jobs
    if (['completed', 'cancelled'].includes(existingJob.status) && updateData.status) {
      throw new BusinessLogicError(
        'Cannot modify completed or cancelled jobs',
        context,
        'This job cannot be modified because it has been completed or cancelled'
      )
    }

    // 7. Optimistic locking check (if timestamp provided)
    if (body.updated_at && body.updated_at !== existingJob.updated_at) {
      throw new BusinessLogicError(
        'Job has been modified by another user',
        context,
        'This job has been updated by someone else. Please refresh and try again.'
      )
    }

    // 8. Update job
    const updatedJob = await monitoredSupabaseQuery(
      supabase
        .from('jobs')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId)
        .select(`
          id,
          title,
          description,
          status,
          priority,
          client_name,
          client_email,
          scheduled_start_date,
          estimated_cost,
          actual_cost,
          updated_at,
          projects (
            id,
            name
          )
        `)
        .single(),
      'update_job',
      {
        job_id: jobId,
        company_id: user.company_id,
        user_id: user.id
      }
    )

    // 9. Log successful update
    await logApiAccess(request, user, 'PUT /api/jobs', true, `Updated job: ${updatedJob.title}`)

    // 10. Return success response
    return createSuccessResponse(
      updatedJob,
      'Job updated successfully',
      {
        job_id: updatedJob.id,
        updated_by: user.id,
        fields_updated: Object.keys(updateData)
      }
    )

  } catch (error) {
    // Enhanced error handling
    await logApiAccess(request, user, 'PUT /api/jobs', false, (error as Error).message)
    
    return await handleApiError(error as Error, request, {
      operation: 'PUT /api/jobs',
      user_id: user?.id,
      company_id: user?.company_id,
      job_id: params.id
    })
  }
}

// =============================================
// DELETE /api/example-enhanced/[id]
// Soft delete with cascade handling
// =============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let user = null

  try {
    // 1. Validate job ID parameter
    const jobId = params.id
    if (!jobId || typeof jobId !== 'string') {
      throw new ValidationError('Invalid job ID parameter')
    }

    // 2. Authentication and authorization
    const authResult = await requireCompanyAccess(request)
    if (authResult.error) {
      return authResult.error
    }
    
    user = authResult.user
    const context = { ...authResult.context, job_id: jobId }

    // 3. Check permissions
    if (!hasPermission(user, 'manage_jobs')) {
      await logApiAccess(request, user, 'DELETE /api/jobs', false, 'Insufficient permissions')
      return createErrorResponse('Insufficient permissions', 403, 'PERMISSION_DENIED')
    }

    // 4. Verify job exists and get related data
    const jobWithRelated = await monitoredSupabaseQuery(
      supabase
        .from('jobs')
        .select(`
          id,
          title,
          company_id,
          status,
          tasks (id, status),
          time_entries (id, status),
          job_assignments (id, status)
        `)
        .eq('id', jobId)
        .single(),
      'get_job_with_related',
      { job_id: jobId, user_id: user.id }
    )

    await validateBusinessRule(
      jobWithRelated && jobWithRelated.company_id === user.company_id,
      'Job not found or access denied',
      context
    )

    // 5. Business rule: Can't delete jobs with active time entries
    const activeTimeEntries = jobWithRelated.time_entries?.filter(te => te.status === 'active') || []
    if (activeTimeEntries.length > 0) {
      throw new BusinessLogicError(
        'Cannot delete job with active time entries',
        { ...context, active_time_entries: activeTimeEntries.length },
        'This job has active time entries. Please complete or cancel them before deleting the job.'
      )
    }

    // 6. Soft delete (mark as deleted instead of actual deletion)
    const deletedJob = await monitoredSupabaseQuery(
      supabase
        .from('jobs')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString()
          // In a real implementation, you might add deleted_at and deleted_by fields
        })
        .eq('id', jobId)
        .select('id, title')
        .single(),
      'soft_delete_job',
      {
        job_id: jobId,
        company_id: user.company_id,
        user_id: user.id
      }
    )

    // 7. Log successful deletion
    await logApiAccess(
      request, 
      user, 
      'DELETE /api/jobs', 
      true, 
      `Soft deleted job: ${deletedJob.title}`
    )

    // 8. Return success response
    return createSuccessResponse(
      { id: deletedJob.id, title: deletedJob.title },
      'Job deleted successfully',
      {
        job_id: deletedJob.id,
        deleted_by: user.id,
        soft_delete: true
      }
    )

  } catch (error) {
    // Enhanced error handling
    await logApiAccess(request, user, 'DELETE /api/jobs', false, (error as Error).message)
    
    return await handleApiError(error as Error, request, {
      operation: 'DELETE /api/jobs',
      user_id: user?.id,
      company_id: user?.company_id,
      job_id: params.id
    })
  }
}