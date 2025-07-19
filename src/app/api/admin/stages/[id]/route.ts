import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const stageId = params.id

    console.log(`Starting deletion of stage: ${stageId}`)

    // Delete in order due to foreign key constraints with proper error checking:
    
    // 1. Delete stage transitions (both from and to this stage)
    const { error: transitionsError } = await supabase
      .from('stage_transitions')
      .delete()
      .or(`from_stage_id.eq.${stageId},to_stage_id.eq.${stageId}`)

    if (transitionsError) {
      console.error('Error deleting stage transitions:', transitionsError)
      return NextResponse.json({ 
        error: 'Failed to delete stage transitions', 
        details: transitionsError,
        step: 'transitions'
      }, { status: 500 })
    }

    // 2. Delete stage questions (this should cascade delete user_responses)
    const { error: questionsError } = await supabase
      .from('stage_questions')
      .delete()
      .eq('stage_id', stageId)

    if (questionsError) {
      console.error('Error deleting stage questions:', questionsError)
      return NextResponse.json({ 
        error: 'Failed to delete stage questions', 
        details: questionsError,
        step: 'questions' 
      }, { status: 500 })
    }

    // 3. Delete task templates (if table exists)
    const { error: templatesError } = await supabase
      .from('task_templates')
      .delete()
      .eq('stage_id', stageId)

    // Don't fail if task_templates table doesn't exist
    if (templatesError && !templatesError.message?.includes('does not exist')) {
      console.error('Error deleting task templates:', templatesError)
      return NextResponse.json({ 
        error: 'Failed to delete task templates', 
        details: templatesError,
        step: 'task_templates'
      }, { status: 500 })
    }

    // 4. Delete job tasks that reference this stage (if table exists)
    const { error: jobTasksError } = await supabase
      .from('job_tasks')
      .delete()
      .eq('stage_id', stageId)

    // Don't fail if job_tasks table doesn't exist or doesn't have stage_id column
    if (jobTasksError && !jobTasksError.message?.includes('does not exist') && !jobTasksError.message?.includes('column')) {
      console.warn('Warning deleting job tasks:', jobTasksError)
    }

    // 5. Update any jobs currently in this stage to null
    const { error: jobsUpdateError } = await supabase
      .from('jobs')
      .update({ current_stage_id: null })
      .eq('current_stage_id', stageId)

    if (jobsUpdateError) {
      console.warn('Warning updating jobs current_stage_id:', jobsUpdateError)
      // Don't fail the deletion for this, just warn
    }

    // 6. Finally delete the stage itself
    const { error: stageError } = await supabase
      .from('job_stages')
      .delete()
      .eq('id', stageId)

    if (stageError) {
      console.error('Error deleting stage:', stageError)
      return NextResponse.json({ 
        error: 'Failed to delete stage after cleaning dependencies', 
        details: stageError,
        step: 'stage'
      }, { status: 500 })
    }

    console.log(`Successfully deleted stage: ${stageId}`)
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error in stage DELETE API:', error)
    return NextResponse.json({ 
      error: 'Internal server error during stage deletion', 
      details: error instanceof Error ? error.message : 'Unknown error',
      step: 'catch'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const stageId = params.id
    const updates = await request.json()

    const { data: stage, error } = await supabase
      .from('job_stages')
      .update(updates)
      .eq('id', stageId)
      .select()
      .single()

    if (error) {
      console.error('Error updating stage:', error)
      return NextResponse.json({ error: 'Failed to update stage', details: error }, { status: 500 })
    }

    return NextResponse.json({ data: stage })
  } catch (error) {
    console.error('Error in stage PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}