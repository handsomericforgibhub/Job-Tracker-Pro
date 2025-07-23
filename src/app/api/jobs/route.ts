import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { LIMITS } from '@/config/timeouts'

// GET - Fetch jobs with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const status = searchParams.get('status')
    const created_by = searchParams.get('created_by')
    const limit = parseInt(searchParams.get('limit') || String(LIMITS.API_PAGE_SIZE_LARGE))
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('jobs')
      .select(`
        *,
        foreman:users!jobs_foreman_id_fkey(
          id,
          full_name,
          email
        ),
        current_stage:job_stages!current_stage_id(
          id,
          name,
          description,
          color,
          sequence_order,
          maps_to_status,
          stage_type,
          min_duration_hours,
          max_duration_hours
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (company_id) query = query.eq('company_id', company_id)
    if (status) query = query.eq('status', status)
    if (created_by) query = query.eq('created_by', created_by)

    const { data: jobs, error } = await query

    if (error) {
      console.error('Error fetching jobs:', error)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({
      jobs: jobs || []
    })

  } catch (error) {
    console.error('Get jobs error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Create new job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json({ error: 'Job title is required' }, { status: 400 })
    }

    if (!body.company_id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // Check for duplicate job title within the same company
    const { data: existingJob, error: duplicateCheckError } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('company_id', body.company_id)
      .ilike('title', body.title.trim())
      .limit(1)

    if (duplicateCheckError) {
      console.warn('Error checking for duplicate job title:', duplicateCheckError)
    } else if (existingJob && existingJob.length > 0) {
      return NextResponse.json({ 
        error: `A job with the title "${body.title.trim()}" already exists in your company`,
        code: '23505',
        details: 'Duplicate job title within company'
      }, { status: 409 })
    }

    // Validate current_stage_id exists in job_stages table
    if (body.current_stage_id) {
      const { data: stageExists, error: stageCheckError } = await supabase
        .from('job_stages')
        .select('id, name')
        .eq('id', body.current_stage_id)
        .single()

      if (stageCheckError || !stageExists) {
        console.error('Invalid current_stage_id provided:', body.current_stage_id, stageCheckError)
        return NextResponse.json({ 
          error: 'Invalid stage ID provided. The specified stage does not exist.',
          code: '23503',
          details: `Stage ID ${body.current_stage_id} not found in job_stages table`
        }, { status: 400 })
      }

      console.log('✅ Stage validation passed:', stageExists.name)
    } else {
      // If no current_stage_id provided, try to get the first available stage
      const { data: firstStage, error: firstStageError } = await supabase
        .from('job_stages')
        .select('id, name, sequence_order')
        .or(`company_id.eq.${body.company_id},company_id.is.null`)
        .order('sequence_order', { ascending: true })
        .limit(1)

      if (firstStageError || !firstStage || firstStage.length === 0) {
        console.error('No stages available for company:', body.company_id, firstStageError)
        return NextResponse.json({ 
          error: 'No job stages configured. Please contact your administrator to set up job stages.',
          code: 'NO_STAGES',
          details: 'No stages found in job_stages table for this company'
        }, { status: 400 })
      }

      // Auto-assign the first stage
      body.current_stage_id = firstStage[0].id
      body.stage_entered_at = new Date().toISOString()
      console.log('✅ Auto-assigned first stage:', firstStage[0].name)
    }

    // Validate foreman assignment if provided
    if (body.foreman_id) {
      const { data: foreman, error: foremanError } = await supabase
        .from('users')
        .select('id, role, company_id')
        .eq('id', body.foreman_id)
        .single()

      if (foremanError || !foreman) {
        return NextResponse.json({ error: 'Invalid foreman selected' }, { status: 400 })
      }

      if (foreman.role !== 'foreman') {
        return NextResponse.json({ error: 'Selected user is not a foreman' }, { status: 400 })
      }

      if (foreman.company_id !== body.company_id) {
        return NextResponse.json({ error: 'Foreman must be from the same company' }, { status: 400 })
      }
    }

    const { data: job, error: insertError } = await supabase
      .from('jobs')
      .insert(body)
      .select(`
        *,
        foreman:users!jobs_foreman_id_fkey(
          id,
          full_name,
          email
        ),
        current_stage:job_stages!current_stage_id(
          id,
          name,
          description,
          color,
          sequence_order,
          maps_to_status,
          stage_type,
          min_duration_hours,
          max_duration_hours
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating job:', JSON.stringify(insertError, null, 2))
      
      // Handle specific PostgreSQL error codes
      let errorMessage = 'Failed to create job'
      let statusCode = 500
      
      if (insertError.code === '23505') {
        // Unique constraint violation
        statusCode = 409
        if (insertError.details && insertError.details.includes('title')) {
          errorMessage = 'A job with this title already exists in your company'
        } else {
          errorMessage = 'A job with similar details already exists'
        }
      } else if (insertError.code === '23503') {
        // Foreign key constraint violation
        statusCode = 400
        errorMessage = 'Invalid reference data provided'
      } else if (insertError.code === '23514') {
        // Check constraint violation
        statusCode = 400
        errorMessage = 'Invalid data provided - please check your input values'
      } else if (insertError.message) {
        errorMessage = insertError.message
      }
      
      return NextResponse.json({ 
        error: errorMessage,
        code: insertError.code,
        details: insertError.details 
      }, { status: statusCode })
    }

    return NextResponse.json({
      job,
      message: 'Job created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create job error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}