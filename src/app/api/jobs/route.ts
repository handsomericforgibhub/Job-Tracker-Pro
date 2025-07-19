import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch jobs with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const status = searchParams.get('status')
    const created_by = searchParams.get('created_by')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('jobs')
      .select(`
        *,
        foreman:users!jobs_foreman_id_fkey(
          id,
          full_name,
          email
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
        )
      `)
      .single()

    if (insertError) {
      console.error('Error creating job:', insertError)
      return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
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