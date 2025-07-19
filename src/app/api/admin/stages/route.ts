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

    // Check if user is owner or site admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, company_id')
      .eq('id', user.id)
      .single()

    if (userError || (userData.role !== 'owner' && userData.role !== 'site_admin')) {
      return NextResponse.json({ error: 'Access denied. Only owners and site administrators can manage stages.' }, { status: 403 })
    }

    // For site admins, we need to get company_id from request or session
    // For now, let's get all stages and filter in the frontend based on company context
    let targetCompanyId = userData.company_id

    // If site admin, they might be working with a different company context
    if (userData.role === 'site_admin') {
      // For site admins, we'll get global stages (company_id = null) 
      // The frontend will handle company context
      targetCompanyId = null
    }

    // Get stages for the company (or global stages for site admins)
    let query = supabase
      .from('job_stages')
      .select(`
        *,
        questions:stage_questions(*),
        transitions_from:stage_transitions!stage_transitions_from_stage_id_fkey(*),
        transitions_to:stage_transitions!stage_transitions_to_stage_id_fkey(*)
      `)
      .order('sequence_order')

    if (targetCompanyId) {
      query = query.eq('company_id', targetCompanyId)
    } else {
      query = query.is('company_id', null)
    }

    const { data: stages, error: stagesError } = await query

    if (stagesError) {
      console.error('Error fetching stages:', stagesError)
      return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
    }

    return NextResponse.json({ data: stages })
  } catch (error) {
    console.error('Error in stages API:', error)
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

    if (userError || (userData.role !== 'owner' && userData.role !== 'site_admin')) {
      return NextResponse.json({ error: 'Access denied. Only owners and site administrators can manage stages.' }, { status: 403 })
    }

    const { name, description, color, sequence_order, maps_to_status, stage_type, min_duration_hours, max_duration_hours } = body

    // Create new stage
    const { data: newStage, error: createError } = await supabase
      .from('job_stages')
      .insert({
        name,
        description,
        color,
        sequence_order,
        maps_to_status,
        stage_type: stage_type || 'standard',
        min_duration_hours: min_duration_hours || 1,
        max_duration_hours: max_duration_hours || 168,
        company_id: userData.company_id,
        created_by: user.id
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating stage:', createError)
      return NextResponse.json({ error: 'Failed to create stage' }, { status: 500 })
    }

    return NextResponse.json({ data: newStage })
  } catch (error) {
    console.error('Error in stages POST API:', error)
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

    if (userError || (userData.role !== 'owner' && userData.role !== 'site_admin')) {
      return NextResponse.json({ error: 'Access denied. Only owners and site administrators can manage stages.' }, { status: 403 })
    }

    const { stages } = body

    // Update multiple stages in a transaction
    const updatePromises = stages.map((stage: any) => 
      supabase
        .from('job_stages')
        .update({
          name: stage.name,
          description: stage.description,
          color: stage.color,
          sequence_order: stage.sequence_order,
          maps_to_status: stage.maps_to_status,
          stage_type: stage.stage_type,
          min_duration_hours: stage.min_duration_hours,
          max_duration_hours: stage.max_duration_hours
        })
        .eq('id', stage.id)
        .eq('company_id', userData.company_id)
    )

    const results = await Promise.all(updatePromises)
    
    // Check for errors
    const errors = results.filter(result => result.error)
    if (errors.length > 0) {
      console.error('Error updating stages:', errors)
      return NextResponse.json({ error: 'Failed to update some stages' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in stages PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}