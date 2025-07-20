import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { RESPONSE_TYPES, isValidResponseType } from '@/config/constants'
import { 
  StageProgressionResult, 
  QuestionFormData,
  ResponseSource 
} from '@/lib/types/question-driven'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
      question_id, 
      response_value, 
      response_metadata = {},
      response_source = 'web_app' 
    }: {
      question_id: string
      response_value: string
      response_metadata?: any
      response_source?: ResponseSource
    } = body

    console.log('🔄 Processing stage response:', {
      jobId,
      question_id,
      response_value,
      user: user.email
    })

    // Validate required fields
    if (!question_id || !response_value) {
      return NextResponse.json({ 
        error: 'Missing required fields: question_id, response_value' 
      }, { status: 400 })
    }

    // Verify job exists and user has access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, current_stage_id, company_id')
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

    // Verify question exists and belongs to current stage
    const { data: question, error: questionError } = await supabase
      .from('stage_questions')
      .select('id, stage_id, question_text, response_type, is_required')
      .eq('id', question_id)
      .single()

    if (questionError || !question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    if (question.stage_id !== job.current_stage_id) {
      return NextResponse.json({ 
        error: 'Question does not belong to current stage' 
      }, { status: 400 })
    }

    // Validate response format
    const validationResult = validateResponseFormat(question.response_type, response_value)
    if (!validationResult.valid) {
      return NextResponse.json({ 
        error: validationResult.error 
      }, { status: 400 })
    }

    // Call the database function to process the response
    const { data: progressionResult, error: progressionError } = await supabase
      .rpc('process_stage_response', {
        p_job_id: jobId,
        p_question_id: question_id,
        p_response_value: response_value,
        p_user_id: user.id,
        p_response_source: response_source,
        p_response_metadata: response_metadata
      })

    if (progressionError) {
      console.error('❌ Stage progression error:', progressionError)
      return NextResponse.json({ 
        error: 'Stage progression failed: ' + progressionError.message 
      }, { status: 500 })
    }

    console.log('✅ Stage progression result:', progressionResult)

    // Get updated job data
    const { data: updatedJob, error: updatedJobError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        current_stage_id,
        stage_entered_at,
        status,
        updated_at,
        current_stage:job_stages!current_stage_id (
          id,
          name,
          description,
          color,
          maps_to_status
        )
      `)
      .eq('id', jobId)
      .single()

    if (updatedJobError) {
      console.error('❌ Error fetching updated job:', updatedJobError)
    }

    // Get newly created tasks if any
    let newTasks = []
    if (progressionResult.tasks_created > 0) {
      const { data: tasks } = await supabase
        .from('job_tasks')
        .select(`
          id,
          title,
          description,
          status,
          due_date,
          priority,
          template:task_templates!template_id (
            task_type,
            client_visible
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(progressionResult.tasks_created)

      newTasks = tasks || []
    }

    // Build comprehensive response
    const result: StageProgressionResult & {
      job?: any
      new_tasks?: any[]
    } = {
      ...progressionResult,
      job: updatedJob,
      new_tasks: newTasks
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('❌ Error in stage-response API:', error)
    
    // Log error to audit trail
    try {
      const { id: jobId } = await params
      const authHeader = request.headers.get('authorization')
      
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)
        
        if (user) {
          await supabase
            .from('stage_audit_log')
            .insert({
              job_id: jobId,
              trigger_source: 'error',
              triggered_by: user.id,
              trigger_details: {
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
              }
            })
        }
      }
    } catch (auditError) {
      console.error('❌ Failed to log error to audit trail:', auditError)
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to validate response format
function validateResponseFormat(
  responseType: string, 
  responseValue: string
): { valid: boolean; error?: string } {
  switch (responseType) {
    case RESPONSE_TYPES.YES_NO:
      if (!['Yes', 'No'].includes(responseValue)) {
        return { valid: false, error: 'Response must be "Yes" or "No"' }
      }
      break

    case RESPONSE_TYPES.NUMBER:
      if (!/^\d+(\.\d+)?$/.test(responseValue)) {
        return { valid: false, error: 'Response must be a valid number' }
      }
      break

    case RESPONSE_TYPES.DATE:
      if (isNaN(Date.parse(responseValue))) {
        return { valid: false, error: 'Response must be a valid date' }
      }
      break

    case RESPONSE_TYPES.FILE_UPLOAD:
      if (!responseValue || responseValue.trim().length === 0) {
        return { valid: false, error: 'File upload response cannot be empty' }
      }
      break

    case RESPONSE_TYPES.TEXT:
    case RESPONSE_TYPES.MULTIPLE_CHOICE:
      // Text and multiple choice don't need specific validation
      break

    default:
      return { valid: false, error: 'Unknown response type' }
  }

  return { valid: true }
}