import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { RESPONSE_TYPES, isValidResponseType } from '@/config/constants'
import { 
  StageProgressionResult, 
  QuestionFormData,
  ResponseSource 
} from '@/lib/types/question-driven'
import { validateAuth, createAuthErrorResponse, AuthenticationError } from '@/lib/auth-middleware'

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

    // Use auth middleware for authentication and user profile lookup
    let user
    try {
      user = await validateAuth(request)
    } catch (error) {
      // If user profile is missing but user is authenticated, create a minimal profile
      if (error instanceof Error && 'code' in error && (error as any).code === 'INCOMPLETE_PROFILE') {
        console.log('⚠️ User profile incomplete, attempting to get auth user directly')
        
        const authHeader = request.headers.get('authorization')
        if (!authHeader) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token)
        
        if (authError || !authUser) {
          return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        // Try to create the missing user profile in the database
        console.log('🔧 Attempting to create missing user profile in database')
        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email,
            full_name: authUser.email?.split('@')[0] || 'User',
            role: 'worker',
            company_id: null
          })
          .select('id, email, role, company_id')
          .single()

        if (createError) {
          console.error('❌ Failed to create user profile:', createError)
          // Fallback to minimal user object
          user = {
            id: authUser.id,
            email: authUser.email || '',
            role: 'worker' as const,
            company_id: null
          }
          console.log('🔧 Using fallback user object:', user)
        } else {
          user = createdUser
          console.log('✅ Created missing user profile:', user)
        }
      } else {
        throw error
      }
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
      userId: user.id,
      userEmail: user.email,
      userCompany: user.company_id
    })

    // Validate required fields
    if (!question_id || !response_value) {
      return NextResponse.json({ 
        error: 'Missing required fields: question_id, response_value' 
      }, { status: 400 })
    }

    // Verify job exists - use service role if user has no company_id to bypass RLS
    let job, jobError
    
    if (!user.company_id) {
      // User has no company_id, so we need to bypass RLS to find the job first
      console.log('🔧 Using service role to lookup job due to user having no company_id')
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const jobResult = await supabaseAdmin
        .from('jobs')
        .select('id, title, current_stage_id, company_id')
        .eq('id', jobId)
        .maybeSingle()
      
      job = jobResult.data
      jobError = jobResult.error
    } else {
      // User has company_id, use normal client with RLS
      const jobResult = await supabase
        .from('jobs')
        .select('id, title, current_stage_id, company_id')
        .eq('id', jobId)
        .maybeSingle()
      
      job = jobResult.data
      jobError = jobResult.error
    }

    console.log('🔍 Job lookup:', { jobId, job, jobError, userCompany: user.company_id, userRole: user.role })

    if (jobError) {
      console.error('❌ Job lookup failed:', { 
        jobId, 
        error: jobError, 
        errorCode: jobError?.code,
        errorMessage: jobError?.message,
        userRole: user.role,
        userCompany: user.company_id
      })
      
      return NextResponse.json({ 
        error: 'Failed to access job',
        details: jobError?.message || 'Unknown database error'
      }, { status: 500 })
    }

    if (!job) {
      return NextResponse.json({ 
        error: 'Job not found',
        details: `Job ${jobId} does not exist or you don't have permission to access it`
      }, { status: 404 })
    }

    // DEBUG: Enhanced logging for permission issues
    console.log('🔍 Permission check details:', {
      jobFound: !!job,
      jobId: job?.id,
      jobCompanyId: job?.company_id,
      userRole: user.role,
      userCompanyId: user.company_id,
      userEmail: user.email,
      shouldCheckCompany: user.role !== 'site_admin' && user.company_id !== null
    })

    // For multi-tenant security: users can only access jobs from their company
    // Exception: site_admins can access any company's jobs
    // Exception: users without company_id (incomplete profiles) get special handling
    if (user.role !== 'site_admin') {
      if (!user.company_id) {
        console.log('⚠️ User has no company_id - checking if job has company_id too')
        
        // If user has no company_id, they can only access jobs that also have no company_id
        // OR we need to assign them to a company
        if (job.company_id) {
          console.log('🔧 User has no company but job belongs to company - attempting to assign user to job\'s company')
          
          // Try to update user's company_id to match the job's company
          const { error: updateError } = await supabase
            .from('users')
            .update({ company_id: job.company_id })
            .eq('id', user.id)
          
          if (updateError) {
            console.error('❌ Failed to assign user to company:', updateError)
            return NextResponse.json({ 
              error: 'User profile incomplete and cannot be auto-assigned to company',
              details: `Please contact admin to assign you to a company. Job belongs to company ${job.company_id}`
            }, { status: 403 })
          } else {
            console.log('✅ Successfully assigned user to company:', job.company_id)
            user.company_id = job.company_id // Update local user object
          }
        }
      } else if (user.company_id !== job.company_id) {
        console.error('❌ Permission denied - company mismatch:', { 
          userRole: user.role,
          userCompany: user.company_id,
          jobCompany: job.company_id
        })
        return NextResponse.json({ 
          error: 'Insufficient permissions',
          details: `User belongs to company ${user.company_id} but job belongs to company ${job.company_id}`
        }, { status: 403 })
      }
    }

    // Verify question exists and belongs to current stage
    // Use service role if user has no company_id to bypass RLS
    let question, questionError
    
    if (!user.company_id) {
      console.log('🔧 Using service role to lookup question due to user having no company_id')
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const questionResult = await supabaseAdmin
        .from('stage_questions')
        .select('id, stage_id, question_text, response_type, is_required')
        .eq('id', question_id)
        .single()
      
      question = questionResult.data
      questionError = questionResult.error
    } else {
      const questionResult = await supabase
        .from('stage_questions')
        .select('id, stage_id, question_text, response_type, is_required')
        .eq('id', question_id)
        .single()
      
      question = questionResult.data
      questionError = questionResult.error
    }

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
    // Use service role if user has no company_id to bypass RLS
    let progressionResult, progressionError
    
    const clientToUse = !user.company_id ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    ) : supabase
    
    if (!user.company_id) {
      console.log('🔧 Using service role for RPC call due to user having no company_id')
    }
    
    const rpcResult = await clientToUse.rpc('process_stage_response', {
      p_job_id: jobId,
      p_question_id: question_id,
      p_response_value: response_value,
      p_user_id: user.id,
      p_response_source: response_source,
      p_response_metadata: response_metadata
    })
    
    progressionResult = rpcResult.data
    progressionError = rpcResult.error

    if (progressionError) {
      console.error('❌ Stage progression error:', progressionError)
      return NextResponse.json({ 
        error: 'Stage progression failed: ' + progressionError.message 
      }, { status: 500 })
    }

    console.log('✅ Stage progression result:', progressionResult)

    // Get updated job data using the same client pattern
    const { data: updatedJob, error: updatedJobError } = await clientToUse
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

    // Get newly created tasks if any using the same client pattern
    let newTasks = []
    if (progressionResult.tasks_created > 0) {
      const { data: tasks } = await clientToUse
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
    const responseData: StageProgressionResult & {
      job?: any
      new_tasks?: any[]
    } = {
      ...progressionResult,
      job: updatedJob,
      new_tasks: newTasks
    }

    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('❌ Error in stage-response API:', error)
    
    // Handle authentication errors from middleware
    if (error instanceof Error && 'status' in error) {
      return createAuthErrorResponse(error as AuthenticationError)
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