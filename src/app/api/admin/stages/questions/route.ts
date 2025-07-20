import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { RESPONSE_TYPES, isValidResponseType } from '@/config/constants'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stage_id')

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

    // Return global questions only for now
    const filteredQuestions = questions?.filter(q => q.stage?.company_id === null)

    return NextResponse.json({ data: filteredQuestions })
  } catch (error) {
    console.error('Error in questions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      stage_id, 
      question_text, 
      response_type, 
      sequence_order, 
      help_text, 
      skip_conditions,
      reminder_enabled,
      default_reminder_offset_hours,
      response_options,
      is_required
    } = body

    // Create new question (TODO: Add proper authentication)
    const { data: newQuestion, error: createError } = await supabase
      .from('stage_questions')
      .insert({
        stage_id,
        question_text,
        response_type,
        sequence_order,
        help_text,
        skip_conditions: skip_conditions || {},
        reminder_enabled: reminder_enabled || false,
        default_reminder_offset_hours: default_reminder_offset_hours || 24,
        response_options: response_type === RESPONSE_TYPES.MULTIPLE_CHOICE ? response_options : null,
        is_required: is_required !== undefined ? is_required : true
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
    const body = await request.json()
    const { questions } = body

    // Update multiple questions (TODO: Add proper authentication)
    const updatePromises = questions.map((question: any) => 
      supabase
        .from('stage_questions')
        .update({
          question_text: question.question_text,
          response_type: question.response_type,
          sequence_order: question.sequence_order,
          help_text: question.help_text,
          skip_conditions: question.skip_conditions || {}
        })
        .eq('id', question.id)
    )

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
    const { searchParams } = new URL(request.url)
    const questionId = searchParams.get('id')
    
    if (!questionId) {
      return NextResponse.json({ error: 'Question ID required' }, { status: 400 })
    }

    // Delete question (TODO: Add proper authentication and access control)
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