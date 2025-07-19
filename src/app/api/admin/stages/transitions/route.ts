import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get transitions (TODO: Add proper authentication and filtering)
    const { data: transitions, error: transitionsError } = await supabase
      .from('stage_transitions')
      .select(`
        *,
        from_stage:job_stages!stage_transitions_from_stage_id_fkey(id, name, company_id),
        to_stage:job_stages!stage_transitions_to_stage_id_fkey(id, name, company_id)
      `)

    if (transitionsError) {
      console.error('Error fetching transitions:', transitionsError)
      return NextResponse.json({ error: 'Failed to fetch transitions' }, { status: 500 })
    }

    // Return global transitions only for now
    const filteredTransitions = transitions?.filter(t => 
      t.from_stage?.company_id === null ||
      t.to_stage?.company_id === null
    )

    return NextResponse.json({ data: filteredTransitions })
  } catch (error) {
    console.error('Error in transitions API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { from_stage_id, to_stage_id, trigger_response, conditions, is_automatic } = body

    // Validate that this is not a self-transition
    if (from_stage_id === to_stage_id) {
      console.error('Attempted to create self-transition:', { from_stage_id, to_stage_id })
      return NextResponse.json({ 
        error: 'Self-transitions are not allowed', 
        details: 'A stage cannot transition to itself',
        from_stage_id,
        to_stage_id
      }, { status: 400 })
    }

    // Create new transition (TODO: Add proper authentication and validation)
    const { data: newTransition, error: createError } = await supabase
      .from('stage_transitions')
      .insert({
        from_stage_id,
        to_stage_id,
        trigger_response,
        conditions: conditions || {},
        is_automatic: is_automatic || false
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating transition:', createError)
      return NextResponse.json({ error: 'Failed to create transition' }, { status: 500 })
    }

    return NextResponse.json({ data: newTransition })
  } catch (error) {
    console.error('Error in transitions POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { transitions } = body

    // Update multiple transitions (TODO: Add proper authentication)
    const updatePromises = transitions.map((transition: any) => 
      supabase
        .from('stage_transitions')
        .update({
          trigger_response: transition.trigger_response,
          conditions: transition.conditions || {},
          is_automatic: transition.is_automatic || false
        })
        .eq('id', transition.id)
    )

    const results = await Promise.all(updatePromises)
    
    // Check for errors
    const errors = results.filter(result => result.error)
    if (errors.length > 0) {
      console.error('Error updating transitions:', errors)
      return NextResponse.json({ error: 'Failed to update some transitions' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in transitions PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const transitionId = searchParams.get('id')
    
    if (!transitionId) {
      return NextResponse.json({ error: 'Transition ID required' }, { status: 400 })
    }

    // Delete transition (TODO: Add proper authentication and access control)
    const { error: deleteError } = await supabase
      .from('stage_transitions')
      .delete()
      .eq('id', transitionId)

    if (deleteError) {
      console.error('Error deleting transition:', deleteError)
      return NextResponse.json({ error: 'Failed to delete transition' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in transitions DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}