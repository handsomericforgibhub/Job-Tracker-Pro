import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JobTask, TaskUpdateRequest } from '@/lib/types/question-driven'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // Filter by status
    const clientVisible = searchParams.get('client_visible') // Filter by client visibility

    // Get authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('🔄 Getting tasks for job:', jobId)

    // Verify job exists and user has access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_id, current_stage_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check user permission
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || (userData.role !== 'site_admin' && userData.company_id !== job.company_id)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Build query
    let query = supabase
      .from('job_tasks')
      .select(`
        id,
        job_id,
        template_id,
        status,
        title,
        description,
        subtasks,
        assigned_to,
        due_date,
        completed_at,
        upload_urls,
        upload_verified,
        notes,
        client_response_required,
        client_response_token,
        created_at,
        updated_at,
        template:task_templates!template_id (
          id,
          task_type,
          priority,
          client_visible,
          upload_required,
          upload_file_types,
          max_file_size_mb,
          sla_hours
        ),
        assignee:users!assigned_to (
          id,
          full_name,
          email
        )
      `)
      .eq('job_id', jobId)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (clientVisible === 'true') {
      query = query.eq('template.client_visible', true)
    }

    // Execute query
    const { data: tasks, error: tasksError } = await query
      .order('created_at', { ascending: false })

    if (tasksError) {
      console.error('❌ Error fetching tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Calculate task statistics
    const taskStats = {
      total: tasks?.length || 0,
      pending: tasks?.filter(t => t.status === 'pending').length || 0,
      in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
      completed: tasks?.filter(t => t.status === 'completed').length || 0,
      overdue: tasks?.filter(t => t.status === 'overdue').length || 0,
      completion_rate: 0
    }

    if (taskStats.total > 0) {
      taskStats.completion_rate = Math.round((taskStats.completed / taskStats.total) * 100)
    }

    // Check for SLA violations
    const now = new Date()
    const slaViolations = tasks?.filter(task => {
      if (!task.template?.sla_hours || task.status === 'completed') {
        return false
      }
      
      const createdAt = new Date(task.created_at)
      const slaDeadline = new Date(createdAt.getTime() + (task.template.sla_hours * 60 * 60 * 1000))
      return now > slaDeadline
    }) || []

    console.log('✅ Tasks retrieved:', {
      total: taskStats.total,
      sla_violations: slaViolations.length
    })

    return NextResponse.json({
      success: true,
      data: {
        tasks: tasks || [],
        stats: taskStats,
        sla_violations: slaViolations.length
      }
    })

  } catch (error) {
    console.error('❌ Error in tasks API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

    // Get authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { 
      title, 
      description, 
      subtasks = [], 
      due_date, 
      priority = 'normal',
      assigned_to,
      client_visible = false
    } = body

    console.log('🔄 Creating manual task for job:', jobId)

    // Verify job exists and user has access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_id, current_stage_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check user permission
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || (userData.role !== 'site_admin' && userData.company_id !== job.company_id)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Create a manual task template first
    const { data: template, error: templateError } = await supabase
      .from('task_templates')
      .insert({
        stage_id: job.current_stage_id,
        task_type: 'manual',
        title: title,
        description: description,
        subtasks: subtasks,
        priority: priority,
        auto_assign_to: 'creator',
        client_visible: client_visible
      })
      .select('id')
      .single()

    if (templateError) {
      console.error('❌ Error creating task template:', templateError)
      return NextResponse.json({ error: 'Failed to create task template' }, { status: 500 })
    }

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from('job_tasks')
      .insert({
        job_id: jobId,
        template_id: template.id,
        title: title,
        description: description,
        subtasks: subtasks,
        assigned_to: assigned_to || user.id,
        due_date: due_date,
        status: 'pending'
      })
      .select(`
        id,
        job_id,
        template_id,
        status,
        title,
        description,
        subtasks,
        assigned_to,
        due_date,
        created_at,
        updated_at,
        template:task_templates!template_id (
          task_type,
          priority,
          client_visible
        ),
        assignee:users!assigned_to (
          id,
          full_name,
          email
        )
      `)
      .single()

    if (taskError) {
      console.error('❌ Error creating task:', taskError)
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }

    console.log('✅ Task created:', task.id)

    return NextResponse.json({
      success: true,
      data: task
    })

  } catch (error) {
    console.error('❌ Error in create task API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}