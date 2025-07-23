import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('company_id')
    
    // Determine which stages to fetch
    let stagesQuery = supabase
      .from('job_stages')
      .select(`
        *,
        questions:stage_questions(*),
        transitions_from:stage_transitions!stage_transitions_from_stage_id_fkey(*),
        transitions_to:stage_transitions!stage_transitions_to_stage_id_fkey(*)
      `)
    
    if (companyId && companyId !== 'null') {
      // Fetch company-specific stages first, fallback to global if none exist
      const { data: companyStages } = await supabase
        .from('job_stages')
        .select('id')
        .eq('company_id', companyId)
        .limit(1)
      
      if (companyStages && companyStages.length > 0) {
        // Company has custom stages
        stagesQuery = stagesQuery.eq('company_id', companyId)
      } else {
        // Fall back to global stages
        stagesQuery = stagesQuery.filter('company_id', 'is', null)
      }
    } else {
      // Fetch global stages (platform-wide view)
      stagesQuery = stagesQuery.filter('company_id', 'is', null)
    }
    
    const { data: stages, error: stagesError } = await stagesQuery.order('sequence_order')

    if (stagesError) {
      console.error('Error fetching stages:', stagesError)
      return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
    }

    // Sort questions within each stage by sequence_order
    const stagesWithSortedQuestions = stages?.map(stage => ({
      ...stage,
      questions: stage.questions ? 
        [...stage.questions].sort((a, b) => a.sequence_order - b.sequence_order) : 
        []
    }))

    return NextResponse.json({ 
      data: stagesWithSortedQuestions,
      context: {
        company_id: companyId,
        is_global: !companyId || companyId === 'null',
        stage_count: stagesWithSortedQuestions?.length || 0
      }
    })
  } catch (error) {
    console.error('Error in stages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      name, 
      description, 
      color, 
      sequence_order, 
      maps_to_status, 
      stage_type, 
      min_duration_hours, 
      max_duration_hours,
      company_id 
    } = body

    // Create new stage (global or company-specific based on company_id)
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
        company_id: company_id || null, // null for global, UUID for company-specific
        created_by: null  // TODO: Get from auth
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
    const { stages, company_id } = body

    // Update multiple stages with company context awareness
    const updatePromises = stages.map((stage: any) => {
      let query = supabase
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
      
      // Apply company context filter
      if (company_id && company_id !== 'null') {
        query = query.eq('company_id', company_id)
      } else {
        query = query.filter('company_id', 'is', null)
      }
      
      return query
    })

    const results = await Promise.all(updatePromises)
    
    // Check for errors
    const errors = results.filter(result => result.error)
    if (errors.length > 0) {
      console.error('Error updating stages:', errors)
      return NextResponse.json({ error: 'Failed to update some stages' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      context: {
        company_id: company_id,
        is_global: !company_id || company_id === 'null',
        stages_updated: stages.length
      }
    })
  } catch (error) {
    console.error('Error in stages PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}