import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { LIMITS } from '@/config/timeouts'

// GET - Fetch tasks with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const job_id = searchParams.get('job_id')
    const assigned_to = searchParams.get('assigned_to')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const limit = parseInt(searchParams.get('limit') || String(LIMITS.API_PAGE_SIZE_LARGE))
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (job_id) query = query.eq('job_id', job_id)
    if (assigned_to) query = query.eq('assigned_to', assigned_to)
    if (status) query = query.eq('status', status)
    if (priority) query = query.eq('priority', priority)

    const { data: tasks, error } = await query

    if (error) {
      console.error('Error fetching tasks:', error)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    return NextResponse.json({
      tasks: tasks || []
    })

  } catch (error) {
    console.error('Get tasks error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Create new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: task, error: insertError } = await supabase
      .from('tasks')
      .insert(body)
      .select('*')
      .single()

    if (insertError) {
      console.error('Error creating task:', insertError)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    return NextResponse.json({
      task,
      message: 'Task created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create task error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}