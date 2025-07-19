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

    console.log('🔄 Getting performance metrics for job:', jobId)

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

    // Get stage performance metrics
    const { data: metrics, error: metricsError } = await supabase
      .from('stage_performance_metrics')
      .select(`
        id,
        job_id,
        stage_id,
        entered_at,
        exited_at,
        duration_hours,
        tasks_completed,
        tasks_overdue,
        conversion_successful,
        created_at,
        stage:job_stages!stage_id (
          id,
          name,
          description,
          color,
          sequence_order,
          maps_to_status,
          stage_type
        ),
        job:jobs!job_id (
          id,
          title,
          client_name
        )
      `)
      .eq('job_id', jobId)
      .order('entered_at', { ascending: true })

    if (metricsError) {
      console.error('❌ Error fetching performance metrics:', metricsError)
      return NextResponse.json({ error: 'Failed to fetch performance metrics' }, { status: 500 })
    }

    console.log('✅ Performance metrics retrieved:', metrics?.length || 0, 'entries')

    return NextResponse.json({
      success: true,
      data: metrics || []
    })

  } catch (error) {
    console.error('❌ Error in performance-metrics API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}