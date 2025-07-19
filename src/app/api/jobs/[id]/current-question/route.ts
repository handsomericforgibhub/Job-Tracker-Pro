import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { 
  StageQuestion, 
  QuestionFlowState, 
  JobStage, 
  UserResponse 
} from '@/lib/types/question-driven'

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

    console.log('🔄 Getting current question for job:', jobId)

    // Get job with current stage
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        current_stage_id,
        stage_entered_at,
        job_type,
        client_portal_enabled,
        mobile_optimized,
        current_stage:job_stages!current_stage_id (
          id,
          name,
          description,
          color,
          sequence_order,
          maps_to_status,
          stage_type
        )
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      console.error('❌ Error fetching job:', jobError)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // If no current stage, get the first stage
    let currentStageId = job.current_stage_id
    if (!currentStageId) {
      const { data: firstStage } = await supabase
        .from('job_stages')
        .select('id')
        .order('sequence_order')
        .limit(1)
        .single()
      
      if (firstStage) {
        currentStageId = firstStage.id
        
        // Update job with first stage
        await supabase
          .from('jobs')
          .update({ 
            current_stage_id: currentStageId,
            stage_entered_at: new Date().toISOString()
          })
          .eq('id', jobId)
      }
    }

    if (!currentStageId) {
      return NextResponse.json({ error: 'No stages configured' }, { status: 500 })
    }

    // Get all questions for current stage
    const { data: stageQuestions, error: questionsError } = await supabase
      .from('stage_questions')
      .select(`
        id,
        stage_id,
        question_text,
        response_type,
        response_options,
        sequence_order,
        is_required,
        skip_conditions,
        help_text,
        mobile_optimized
      `)
      .eq('stage_id', currentStageId)
      .order('sequence_order')

    if (questionsError) {
      console.error('❌ Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    // Get existing responses for this job
    const { data: existingResponses, error: responsesError } = await supabase
      .from('user_responses')
      .select(`
        id,
        question_id,
        response_value,
        response_metadata,
        responded_by,
        response_source,
        created_at
      `)
      .eq('job_id', jobId)
      .order('created_at')

    if (responsesError) {
      console.error('❌ Error fetching responses:', responsesError)
      return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 })
    }

    // Filter questions based on skip conditions and existing responses
    const answeredQuestionIds = new Set(existingResponses?.map(r => r.question_id) || [])
    const availableQuestions = stageQuestions?.filter(q => !answeredQuestionIds.has(q.id)) || []
    
    // Apply skip conditions
    const filteredQuestions = await Promise.all(
      availableQuestions.map(async (question) => {
        const shouldSkip = await evaluateSkipConditions(question, job, existingResponses || [])
        return shouldSkip ? null : question
      })
    )

    const remainingQuestions = filteredQuestions.filter(q => q !== null) as StageQuestion[]

    // Get current question (first unanswered question)
    const currentQuestion = remainingQuestions[0] || null

    // Get next stage preview if no more questions
    let nextStagePreview: JobStage | null = null
    if (!currentQuestion) {
      const { data: nextStage } = await supabase
        .from('stage_transitions')
        .select(`
          to_stage_id,
          to_stage:job_stages!to_stage_id (
            id,
            name,
            description,
            color,
            sequence_order,
            maps_to_status,
            stage_type
          )
        `)
        .eq('from_stage_id', currentStageId)
        .limit(1)
        .single()

      if (nextStage) {
        nextStagePreview = nextStage.to_stage
      }
    }

    // Build response
    const flowState: QuestionFlowState = {
      job_id: jobId,
      current_stage_id: currentStageId,
      current_question: currentQuestion,
      remaining_questions: remainingQuestions,
      completed_questions: existingResponses || [],
      can_proceed: remainingQuestions.length === 0,
      next_stage_preview: nextStagePreview
    }

    console.log('✅ Question flow state:', {
      stage: currentStageId,
      current_question: currentQuestion?.id,
      remaining: remainingQuestions.length,
      can_proceed: flowState.can_proceed
    })

    return NextResponse.json({
      success: true,
      data: flowState
    })

  } catch (error) {
    console.error('❌ Error in current-question API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Helper function to evaluate skip conditions
async function evaluateSkipConditions(
  question: StageQuestion,
  job: any,
  existingResponses: UserResponse[]
): Promise<boolean> {
  if (!question.skip_conditions || Object.keys(question.skip_conditions).length === 0) {
    return false
  }

  // Check job type-based skipping
  if (question.skip_conditions.job_types?.includes(job.job_type)) {
    return true
  }

  // Check previous response-based skipping
  if (question.skip_conditions.previous_responses) {
    for (const condition of question.skip_conditions.previous_responses) {
      const previousResponse = existingResponses.find(
        r => r.question_id === condition.question_id
      )
      
      if (previousResponse && previousResponse.response_value === condition.response_value) {
        return true
      }
    }
  }

  return false
}