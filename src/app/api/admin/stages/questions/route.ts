import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stage_id')
    
    // Get user and check authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (userError || userData.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied. Only owners can manage questions.' }, { status: 403 })
    }

    let query = supabase
      .from('stage_questions')
      .select(`
        *,
        stage:job_stages!stage_id(id, name, company_id)
      `)
      .order('sequence_order')

    if (stageId) {
      query = query.eq('stage_id', stageId)
    }

    const { data: questions, error: questionsError } = await query

    if (questionsError) {
      console.error('Error fetching questions:', questionsError)
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 })
    }

    // Filter by company ownership
    const filteredQuestions = questions?.filter(q => q.stage?.company_id === userData.company_id)

    return NextResponse.json({ data: filteredQuestions })
  } catch (error) {
    console.error('Error in questions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()
    
    // Get user and check authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (userError || userData.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied. Only owners can manage questions.' }, { status: 403 })
    }

    const { stage_id, question_text, response_type, sequence_order, help_text, skip_conditions } = body

    // Verify stage belongs to user's company
    const { data: stage, error: stageError } = await supabase
      .from('job_stages')
      .select('company_id')
      .eq('id', stage_id)
      .single()

    if (stageError || stage.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Invalid stage or access denied' }, { status: 403 })
    }

    // Create new question
    const { data: newQuestion, error: createError } = await supabase
      .from('stage_questions')
      .insert({
        stage_id,
        question_text,
        response_type,
        sequence_order,
        help_text,
        skip_conditions: skip_conditions || {}
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating question:', createError)
      return NextResponse.json({ error: 'Failed to create question' }, { status: 500 })
    }

    return NextResponse.json({ data: newQuestion })
  } catch (error) {
    console.error('Error in questions POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const body = await request.json()
    
    // Get user and check authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (userError || userData.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied. Only owners can manage questions.' }, { status: 403 })
    }

    const { questions } = body

    // Update multiple questions in a transaction
    const updatePromises = questions.map(async (question: any) => {
      // Verify question belongs to user's company through stage
      const { data: questionData, error: questionError } = await supabase
        .from('stage_questions')
        .select(`
          *,
          stage:job_stages!stage_id(company_id)
        `)
        .eq('id', question.id)
        .single()

      if (questionError || questionData.stage?.company_id !== userData.company_id) {
        throw new Error('Access denied to question')
      }

      return supabase
        .from('stage_questions')
        .update({
          question_text: question.question_text,
          response_type: question.response_type,
          sequence_order: question.sequence_order,
          help_text: question.help_text,
          skip_conditions: question.skip_conditions || {}
        })
        .eq('id', question.id)
    })

    const results = await Promise.all(updatePromises)
    
    // Check for errors
    const errors = results.filter(result => result.error)
    if (errors.length > 0) {
      console.error('Error updating questions:', errors)
      return NextResponse.json({ error: 'Failed to update some questions' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in questions PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('id')
    
    if (!questionId) {
      return NextResponse.json({ error: 'Question ID required' }, { status: 400 })
    }

    // Get user and check authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is owner
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (userError || userData.role !== 'owner') {
      return NextResponse.json({ error: 'Access denied. Only owners can manage questions.' }, { status: 403 })
    }

    // Verify question belongs to user's company through stage
    const { data: questionData, error: questionError } = await supabase
      .from('stage_questions')
      .select(`
        *,
        stage:job_stages!stage_id(company_id)
      `)
      .eq('id', questionId)
      .single()

    if (questionError || questionData.stage?.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Question not found or access denied' }, { status: 404 })
    }

    // Delete question
    const { error: deleteError } = await supabase
      .from('stage_questions')
      .delete()
      .eq('id', questionId)

    if (deleteError) {
      console.error('Error deleting question:', deleteError)
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in questions DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}