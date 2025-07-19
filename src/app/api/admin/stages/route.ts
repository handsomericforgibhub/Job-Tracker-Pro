import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // For now, return global stages (this would normally require proper authentication)
    // TODO: Add proper session-based authentication
    const { data: stages, error: stagesError } = await supabase
      .from('job_stages')
      .select(`
        *,
        questions:stage_questions(*),
        transitions_from:stage_transitions!stage_transitions_from_stage_id_fkey(*),
        transitions_to:stage_transitions!stage_transitions_to_stage_id_fkey(*)
      `)
      .filter('company_id', 'is', null)
      .order('sequence_order')

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
    const body = await request.json()
    const { name, description, color, sequence_order, maps_to_status, stage_type, min_duration_hours, max_duration_hours } = body

    // Create new global stage (TODO: Add proper authentication and company handling)
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
        company_id: null, // Global stage
        created_by: null  // System created
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
    const body = await request.json()
    const { stages } = body

    // Update multiple stages (TODO: Add proper authentication)
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
        .filter('company_id', 'is', null) // Only update global stages
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