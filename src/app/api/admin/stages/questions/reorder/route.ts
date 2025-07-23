import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stage_id, questions } = body

    if (!stage_id || !questions || !Array.isArray(questions)) {
      return NextResponse.json(
        { error: 'Missing required fields: stage_id, questions array' },
        { status: 400 }
      )
    }

    // Validate questions array format
    for (const question of questions) {
      if (!question.id || typeof question.sequence_order !== 'number') {
        return NextResponse.json(
          { error: 'Each question must have id and sequence_order' },
          { status: 400 }
        )
      }
    }

    console.log(`Starting reorder for stage ${stage_id} with ${questions.length} questions`)

    // Try the safer RPC approach first, fall back to two-phase if needed
    try {
      // Attempt to create and use a database function for atomic reordering
      const questionUpdates = questions.map(q => ({
        question_id: q.id,
        new_sequence_order: q.sequence_order
      }))

      const { data: rpcResult, error: rpcError } = await supabase.rpc('reorder_stage_questions', {
        p_stage_id: stage_id,
        p_question_updates: questionUpdates
      })

      if (!rpcError && rpcResult) {
        console.log('Successfully reordered using database function')
        return NextResponse.json({
          message: `Successfully reordered ${questions.length} questions using atomic transaction`,
          updated_questions: rpcResult
        })
      }

      console.log('RPC function not available, falling back to two-phase approach:', rpcError?.message)
    } catch (rpcErr) {
      console.log('RPC approach failed, using two-phase fallback')
    }

    // FALLBACK: Use a two-phase approach to avoid unique constraint violations
    const TEMP_OFFSET = 10000 // Large offset to temporarily move sequence_order out of range
    const updates = []
    const errors = []

    // PHASE 1: Move all questions to temporary sequence_order values (add offset)
    console.log('Phase 1: Moving questions to temporary sequence_order values...')
    for (const question of questions) {
      const { data, error } = await supabase
        .from('stage_questions')
        .update({ 
          sequence_order: question.sequence_order + TEMP_OFFSET
        })
        .eq('id', question.id)
        .eq('stage_id', stage_id)
        .select()

      if (error) {
        console.error(`Phase 1 - Error updating question ${question.id}:`, error)
        errors.push({
          question_id: question.id,
          phase: 'temporary_offset',
          error: error.message
        })
      }
    }

    // If Phase 1 had errors, stop and return them
    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Failed during temporary reordering phase',
          errors,
          phase: 'temporary_offset'
        },
        { status: 500 }
      )
    }

    // PHASE 2: Set final sequence_order values (subtract offset)
    console.log('Phase 2: Setting final sequence_order values...')
    for (const question of questions) {
      const { data, error } = await supabase
        .from('stage_questions')
        .update({ 
          sequence_order: question.sequence_order
        })
        .eq('id', question.id)
        .eq('stage_id', stage_id)
        .select()

      if (error) {
        console.error(`Phase 2 - Error updating question ${question.id}:`, error)
        errors.push({
          question_id: question.id,
          phase: 'final_assignment',
          error: error.message
        })
      } else if (data && data.length > 0) {
        updates.push(data[0])
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Some questions failed to update during final assignment',
          errors,
          updated_count: updates.length,
          failed_count: errors.length,
          phase: 'final_assignment'
        },
        { status: 207 } // Multi-status
      )
    }

    console.log(`Successfully completed two-phase reorder for ${updates.length} questions`)
    return NextResponse.json({
      message: `Successfully reordered ${updates.length} questions using two-phase approach`,
      updated_questions: updates
    })

  } catch (error) {
    console.error('Error in question reorder API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}