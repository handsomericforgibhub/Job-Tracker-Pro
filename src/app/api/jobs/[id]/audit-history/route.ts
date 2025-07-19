import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params

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

    console.log('🔄 Getting audit history for job:', jobId)

    // Verify job exists and user has access
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, company_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check user permission
    const { data: userData } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (!userData || (userData.role !== 'site_admin' && userData.company_id !== job.company_id)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get stage audit log
    const { data: auditLog, error: auditError } = await supabase
      .from('stage_audit_log')
      .select(`
        id,
        job_id,
        from_stage_id,
        to_stage_id,
        from_status,
        to_status,
        trigger_source,
        triggered_by,
        trigger_details,
        question_id,
        response_value,
        duration_in_previous_stage_hours,
        created_at,
        from_stage:job_stages!from_stage_id (
          id,
          name,
          description,
          color,
          sequence_order,
          maps_to_status,
          stage_type
        ),
        to_stage:job_stages!to_stage_id (
          id,
          name,
          description,
          color,
          sequence_order,
          maps_to_status,
          stage_type
        ),
        triggered_by_user:users!triggered_by (
          id,
          full_name,
          email
        )
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: true })

    if (auditError) {
      console.error('❌ Error fetching audit history:', auditError)
      return NextResponse.json({ error: 'Failed to fetch audit history' }, { status: 500 })
    }

    console.log('✅ Audit history retrieved:', auditLog?.length || 0, 'entries')

    return NextResponse.json({
      success: true,
      data: auditLog || []
    })

  } catch (error) {
    console.error('❌ Error in audit-history API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}