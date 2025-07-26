import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create service role client to bypass RLS for testing
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 DEBUG: Testing stage response flow without auth')
    
    const body = await request.json()
    const { 
      job_id = "8a407d97-2543-4805-86d7-e97348a1ab68",
      question_id = "59c655d8-3977-47c5-89b5-bd02c93a6736", 
      response_value = "Yes",
      user_id = "27f035ab-5cf1-49a0-a42b-ca1bd8b50ba5" // handsomeric@hotmail.com
    } = body

    console.log('🔍 Debug parameters:', { job_id, question_id, response_value, user_id })

    // Test 1: Check if user exists in database
    console.log('🧪 TEST 1: Check user exists')
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, role, company_id')
      .eq('id', user_id)
      .maybeSingle()
    
    console.log('User lookup result:', { user, userError })

    // Test 2: Check if job exists
    console.log('🧪 TEST 2: Check job exists')
    const { data: job, error: jobError } = await supabaseAdmin
      .from('jobs')
      .select('id, title, current_stage_id, company_id')
      .eq('id', job_id)
      .maybeSingle()
    
    console.log('Job lookup result:', { job, jobError })

    // Test 3: Check if question exists
    console.log('🧪 TEST 3: Check question exists')
    const { data: question, error: questionError } = await supabaseAdmin
      .from('stage_questions')
      .select('id, stage_id, question_text, response_type, is_required')
      .eq('id', question_id)
      .maybeSingle()
    
    console.log('Question lookup result:', { question, questionError })

    // Test 4: Check if user needs company assignment
    if (user && !user.company_id && job && job.company_id) {
      console.log('🧪 TEST 4: User needs company assignment')
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({ company_id: job.company_id })
        .eq('id', user_id)
      
      console.log('User company assignment result:', { updateError })
      
      if (!updateError) {
        user.company_id = job.company_id
        console.log('✅ User assigned to company:', job.company_id)
      }
    }

    // Test 5: Try the RPC call
    console.log('🧪 TEST 5: Try process_stage_response RPC')
    const { data: progressionResult, error: progressionError } = await supabaseAdmin
      .rpc('process_stage_response', {
        p_job_id: job_id,
        p_question_id: question_id,
        p_response_value: response_value,
        p_user_id: user_id,
        p_response_source: 'debug_test',
        p_response_metadata: {}
      })

    console.log('RPC call result:', { progressionResult, progressionError })

    return NextResponse.json({
      success: true,
      debug_results: {
        user,
        job,
        question,
        progression_result: progressionResult,
        errors: {
          userError,
          jobError,
          questionError,
          progressionError
        }
      }
    })

  } catch (error) {
    console.error('❌ Debug test error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}