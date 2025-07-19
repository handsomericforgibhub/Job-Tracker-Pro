import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    console.log('🔄 Getting all stages for user:', user.email)

    // Get all stages ordered by sequence
    const { data: stages, error: stagesError } = await supabase
      .from('job_stages')
      .select(`
        id,
        name,
        description,
        color,
        sequence_order,
        maps_to_status,
        stage_type,
        min_duration_hours,
        max_duration_hours,
        requires_approval,
        created_at,
        updated_at
      `)
      .order('sequence_order', { ascending: true })

    if (stagesError) {
      console.error('❌ Error fetching stages:', stagesError)
      return NextResponse.json({ error: 'Failed to fetch stages' }, { status: 500 })
    }

    console.log('✅ Stages retrieved:', stages?.length || 0, 'stages')

    return NextResponse.json({
      success: true,
      data: stages || []
    })

  } catch (error) {
    console.error('❌ Error in stages API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}