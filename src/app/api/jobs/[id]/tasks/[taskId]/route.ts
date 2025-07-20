import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TaskUpdateRequest, SubtaskUpdateRequest } from '@/lib/types/question-driven'
import { TASK_STATUSES, isValidTaskStatus } from '@/config/constants'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: jobId, taskId } = await params

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

    console.log('🔄 Getting task:', taskId)

    // Get task with all related data
    const { data: task, error: taskError } = await supabase
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
        ),
        job:jobs!job_id (
          id,
          title,
          company_id,
          client_name
        )
      `)
      .eq('id', taskId)
      .eq('job_id', jobId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check user permission
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || (userData.role !== 'site_admin' && userData.company_id !== task.job.company_id)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Calculate task progress
    const totalSubtasks = task.subtasks?.length || 0
    const completedSubtasks = task.subtasks?.filter((st: any) => st.completed).length || 0
    const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0

    // Check SLA status
    let slaStatus = 'ok'
    if (task.template?.sla_hours && task.status !== TASK_STATUSES.COMPLETED) {
      const createdAt = new Date(task.created_at)
      const slaDeadline = new Date(createdAt.getTime() + (task.template.sla_hours * 60 * 60 * 1000))
      const now = new Date()
      
      if (now > slaDeadline) {
        slaStatus = 'violated'
      } else if (now > new Date(slaDeadline.getTime() - (2 * 60 * 60 * 1000))) { // 2 hours before deadline
        slaStatus = 'warning'
      }
    }

    const enrichedTask = {
      ...task,
      progress,
      sla_status: slaStatus,
      sla_deadline: task.template?.sla_hours 
        ? new Date(new Date(task.created_at).getTime() + (task.template.sla_hours * 60 * 60 * 1000))
        : null
    }

    console.log('✅ Task retrieved:', {
      id: task.id,
      status: task.status,
      progress,
      sla_status: slaStatus
    })

    return NextResponse.json({
      success: true,
      data: enrichedTask
    })

  } catch (error) {
    console.error('❌ Error in get task API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: jobId, taskId } = await params

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
    const updateData: TaskUpdateRequest = body

    console.log('🔄 Updating task:', taskId, updateData)

    // Get current task
    const { data: currentTask, error: currentTaskError } = await supabase
      .from('job_tasks')
      .select(`
        id,
        job_id,
        status,
        subtasks,
        assigned_to,
        template:task_templates!template_id (
          upload_required,
          upload_file_types,
          max_file_size_mb
        ),
        job:jobs!job_id (
          company_id
        )
      `)
      .eq('id', taskId)
      .eq('job_id', jobId)
      .single()

    if (currentTaskError || !currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check user permission
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || (userData.role !== 'site_admin' && userData.company_id !== currentTask.job.company_id)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Process subtask updates
    let updatedSubtasks = currentTask.subtasks || []
    if (updateData.subtasks && Array.isArray(updateData.subtasks)) {
      updatedSubtasks = updatedSubtasks.map((subtask: any) => {
        const update = updateData.subtasks?.find((u: SubtaskUpdateRequest) => u.id === subtask.id)
        if (update) {
          return {
            ...subtask,
            completed: update.completed,
            completed_at: update.completed ? new Date().toISOString() : null,
            completed_by: update.completed ? user.id : null,
            notes: update.notes || subtask.notes,
            upload_urls: update.upload_urls || subtask.upload_urls
          }
        }
        return subtask
      })
    }

    // Determine new task status
    let newStatus = updateData.status || currentTask.status
    if (!updateData.status) {
      // Auto-determine status based on subtasks
      const totalSubtasks = updatedSubtasks.length
      const completedSubtasks = updatedSubtasks.filter((st: any) => st.completed).length
      
      if (totalSubtasks > 0) {
        if (completedSubtasks === totalSubtasks) {
          newStatus = TASK_STATUSES.COMPLETED
        } else if (completedSubtasks > 0) {
          newStatus = 'in_progress'
        } else {
          newStatus = TASK_STATUSES.PENDING
        }
      }
    }

    // Validate file uploads if required
    if (currentTask.template?.upload_required && newStatus === TASK_STATUSES.COMPLETED) {
      const hasUploads = updateData.upload_urls && updateData.upload_urls.length > 0
      if (!hasUploads) {
        return NextResponse.json({ 
          error: 'File upload is required to complete this task' 
        }, { status: 400 })
      }
    }

    // Build update object
    const updateObject: any = {
      subtasks: updatedSubtasks,
      status: newStatus,
      updated_at: new Date().toISOString()
    }

    if (updateData.notes !== undefined) {
      updateObject.notes = updateData.notes
    }

    if (updateData.upload_urls !== undefined) {
      updateObject.upload_urls = updateData.upload_urls
    }

    if (newStatus === TASK_STATUSES.COMPLETED && currentTask.status !== TASK_STATUSES.COMPLETED) {
      updateObject.completed_at = new Date().toISOString()
    }

    // Update the task
    const { data: updatedTask, error: updateError } = await supabase
      .from('job_tasks')
      .update(updateObject)
      .eq('id', taskId)
      .eq('job_id', jobId)
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
        created_at,
        updated_at,
        template:task_templates!template_id (
          task_type,
          priority,
          client_visible,
          upload_required
        ),
        assignee:users!assigned_to (
          id,
          full_name,
          email
        )
      `)
      .single()

    if (updateError) {
      console.error('❌ Error updating task:', updateError)
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }

    // Update stage performance metrics if task completed
    if (newStatus === TASK_STATUSES.COMPLETED && currentTask.status !== TASK_STATUSES.COMPLETED) {
      const { data: job } = await supabase
        .from('jobs')
        .select('current_stage_id')
        .eq('id', jobId)
        .single()

      if (job?.current_stage_id) {
        // Update task completion count for current stage
        await supabase
          .from('stage_performance_metrics')
          .update({
            tasks_completed: supabase.raw('tasks_completed + 1')
          })
          .eq('job_id', jobId)
          .eq('stage_id', job.current_stage_id)
          .is('exited_at', null)
      }
    }

    console.log('✅ Task updated:', {
      id: updatedTask.id,
      status: updatedTask.status,
      completed_subtasks: updatedTask.subtasks?.filter((st: any) => st.completed).length || 0
    })

    return NextResponse.json({
      success: true,
      data: updatedTask
    })

  } catch (error) {
    console.error('❌ Error in update task API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: jobId, taskId } = await params

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

    console.log('🔄 Deleting task:', taskId)

    // Get task to check permissions
    const { data: task, error: taskError } = await supabase
      .from('job_tasks')
      .select(`
        id,
        job_id,
        status,
        job:jobs!job_id (
          company_id
        )
      `)
      .eq('id', taskId)
      .eq('job_id', jobId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Check user permission
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || (userData.role !== 'site_admin' && userData.company_id !== task.job.company_id)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Only allow deletion of pending or cancelled tasks
    if (task.status === TASK_STATUSES.COMPLETED) {
      return NextResponse.json({ 
        error: 'Cannot delete completed tasks' 
      }, { status: 400 })
    }

    // Soft delete by setting status to cancelled
    const { error: deleteError } = await supabase
      .from('job_tasks')
      .update({ 
        status: TASK_STATUSES.CANCELLED,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('job_id', jobId)

    if (deleteError) {
      console.error('❌ Error deleting task:', deleteError)
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }

    console.log('✅ Task deleted:', taskId)

    return NextResponse.json({
      success: true,
      message: 'Task deleted successfully'
    })

  } catch (error) {
    console.error('❌ Error in delete task API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}