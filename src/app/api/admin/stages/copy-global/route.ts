import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { company_id } = await request.json()

    if (!company_id) {
      return NextResponse.json(
        { error: 'Company ID is required' },
        { status: 400 }
      )
    }

    // Get the current user from the session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      )
    }

    // Extract the token and set it for the current request
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    // Check if user is site admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || profile?.role !== 'site_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Site admin access required.' },
        { status: 403 }
      )
    }

    // Verify the company exists
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', company_id)
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }

    // Check if company already has custom stages
    const { data: existingStages, error: existingError } = await supabase
      .from('job_stages')
      .select('id')
      .eq('company_id', company_id)
      .limit(1)

    if (existingError) {
      throw existingError
    }

    if (existingStages && existingStages.length > 0) {
      return NextResponse.json(
        { error: `Company ${company.name} already has custom stages` },
        { status: 409 }
      )
    }

    // Use the database function to copy global stages
    const { data: result, error: copyError } = await supabase
      .rpc('copy_global_stages_to_company', {
        target_company_id: company_id,
        copied_by_user_id: user.id
      })

    if (copyError) {
      console.error('Error copying stages:', copyError)
      return NextResponse.json(
        { error: 'Failed to copy global stages', details: copyError.message },
        { status: 500 }
      )
    }

    // Fetch the newly created stages for confirmation
    const { data: newStages, error: fetchError } = await supabase
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
        company_id
      `)
      .eq('company_id', company_id)
      .order('sequence_order')

    if (fetchError) {
      console.error('Error fetching new stages:', fetchError)
      // Don't fail the request since stages were copied successfully
    }

    return NextResponse.json({
      success: true,
      message: `Successfully copied ${result || 0} global stages to ${company.name}`,
      company: {
        id: company.id,
        name: company.name
      },
      stages_copied: result || 0,
      stages: newStages || []
    })

  } catch (error) {
    console.error('❌ Error in copy-global stages API:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to copy stages.' },
    { status: 405 }
  )
}