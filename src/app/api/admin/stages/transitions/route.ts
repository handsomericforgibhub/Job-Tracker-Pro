import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
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
      return NextResponse.json({ error: 'Access denied. Only owners can manage transitions.' }, { status: 403 })
    }

    // Get transitions for stages belonging to the company
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

    // Filter by company ownership
    const filteredTransitions = transitions?.filter(t => 
      t.from_stage?.company_id === userData.company_id ||
      t.to_stage?.company_id === userData.company_id
    )

    return NextResponse.json({ data: filteredTransitions })
  } catch (error) {
    console.error('Error in transitions API:', error)
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
      return NextResponse.json({ error: 'Access denied. Only owners can manage transitions.' }, { status: 403 })
    }

    const { from_stage_id, to_stage_id, trigger_response, conditions, is_automatic } = body

    // Verify both stages belong to user's company
    const { data: stages, error: stagesError } = await supabase
      .from('job_stages')
      .select('id, company_id')
      .in('id', [from_stage_id, to_stage_id])

    if (stagesError || stages.length !== 2 || !stages.every(s => s.company_id === userData.company_id)) {
      return NextResponse.json({ error: 'Invalid stages or access denied' }, { status: 403 })
    }

    // Create new transition
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
      return NextResponse.json({ error: 'Access denied. Only owners can manage transitions.' }, { status: 403 })
    }

    const { transitions } = body

    // Update multiple transitions in a transaction
    const updatePromises = transitions.map(async (transition: any) => {
      // Verify transition belongs to user's company through stages
      const { data: transitionData, error: transitionError } = await supabase
        .from('stage_transitions')
        .select(`
          *,
          from_stage:job_stages!stage_transitions_from_stage_id_fkey(company_id),
          to_stage:job_stages!stage_transitions_to_stage_id_fkey(company_id)
        `)
        .eq('id', transition.id)
        .single()

      if (transitionError || 
          transitionData.from_stage?.company_id !== userData.company_id ||
          transitionData.to_stage?.company_id !== userData.company_id) {
        throw new Error('Access denied to transition')
      }

      return supabase
        .from('stage_transitions')
        .update({
          trigger_response: transition.trigger_response,
          conditions: transition.conditions || {},
          is_automatic: transition.is_automatic || false
        })
        .eq('id', transition.id)
    })

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
    const supabase = createRouteHandlerClient({ cookies })
    const { searchParams } = new URL(request.url)
    const transitionId = searchParams.get('id')
    
    if (!transitionId) {
      return NextResponse.json({ error: 'Transition ID required' }, { status: 400 })
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
      return NextResponse.json({ error: 'Access denied. Only owners can manage transitions.' }, { status: 403 })
    }

    // Verify transition belongs to user's company through stages
    const { data: transitionData, error: transitionError } = await supabase
      .from('stage_transitions')
      .select(`
        *,
        from_stage:job_stages!stage_transitions_from_stage_id_fkey(company_id),
        to_stage:job_stages!stage_transitions_to_stage_id_fkey(company_id)
      `)
      .eq('id', transitionId)
      .single()

    if (transitionError || 
        transitionData.from_stage?.company_id !== userData.company_id ||
        transitionData.to_stage?.company_id !== userData.company_id) {
      return NextResponse.json({ error: 'Transition not found or access denied' }, { status: 404 })
    }

    // Delete transition
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