import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const questionId = params.id
    const updates = await request.json()

    // Ensure response_options is properly handled
    if (updates.response_type !== 'multiple_choice') {
      updates.response_options = null
    }

    const { data: question, error } = await supabase
      .from('stage_questions')
      .update(updates)
      .eq('id', questionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating question:', error)
      return NextResponse.json({ error: 'Failed to update question', details: error }, { status: 500 })
    }

    return NextResponse.json({ data: question })
  } catch (error) {
    console.error('Error in question PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const questionId = params.id

    // First delete any transitions that reference this question
    await supabase
      .from('stage_transitions')
      .delete()
      .filter('conditions->>question_id', 'eq', questionId)

    // Then delete the question
    const { error } = await supabase
      .from('stage_questions')
      .delete()
      .eq('id', questionId)

    if (error) {
      console.error('Error deleting question:', error)
      return NextResponse.json({ error: 'Failed to delete question', details: error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in question DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}