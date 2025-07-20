import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { STAGES_ARRAY, STAGE_QUESTIONS, STAGE_TRANSITIONS } from '@/config/stages'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    console.log('🔄 Loading stages data...')

    // First, clear existing global stages
    console.log('Clearing existing global stages...')
    const { error: clearStagesError } = await supabase
      .from('job_stages')
      .delete()
      .filter('company_id', 'is', null)

    const { error: clearQuestionsError } = await supabase
      .from('stage_questions')
      .delete()
      .in('stage_id', STAGES_ARRAY.map(s => s.id))

    const { error: clearTransitionsError } = await supabase
      .from('stage_transitions')
      .delete()
      .in('from_stage_id', STAGES_ARRAY.map(s => s.id))

    // Insert stages
    console.log('Inserting stages...')
    const { data: stagesData, error: stagesError } = await supabase
      .from('job_stages')
      .insert(STAGES_ARRAY)
      .select()

    if (stagesError) {
      console.error('Error inserting stages:', stagesError)
      return NextResponse.json({ error: 'Failed to insert stages', details: stagesError }, { status: 500 })
    }

    console.log(`✅ Inserted ${stagesData.length} stages`)

    // Insert questions
    console.log('Inserting stage questions...')
    const { data: questionsData, error: questionsError } = await supabase
      .from('stage_questions')
      .insert(STAGE_QUESTIONS)
      .select()

    if (questionsError) {
      console.error('Error inserting questions:', questionsError)
      return NextResponse.json({ error: 'Failed to insert questions', details: questionsError }, { status: 500 })
    }

    console.log(`✅ Inserted ${questionsData.length} questions`)

    // Insert transitions
    console.log('Inserting stage transitions...')
    const { data: transitionsData, error: transitionsError } = await supabase
      .from('stage_transitions')
      .insert(STAGE_TRANSITIONS)
      .select()

    if (transitionsError) {
      console.error('Error inserting transitions:', transitionsError)
      return NextResponse.json({ error: 'Failed to insert transitions', details: transitionsError }, { status: 500 })
    }

    console.log(`✅ Inserted ${transitionsData.length} transitions`)

    return NextResponse.json({ 
      success: true, 
      message: 'Stage data loaded successfully',
      data: {
        stages: stagesData.length,
        questions: questionsData.length,
        transitions: transitionsData.length
      }
    })

  } catch (error) {
    console.error('❌ Error loading stage data:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}