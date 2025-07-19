import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get the current user session
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const jobId = params.id

    // Fetch job with enhanced details for question-driven system
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        current_stage:job_stages(
          id,
          name,
          description,
          color,
          sequence_order,
          maps_to_status
        ),
        foreman:users!jobs_foreman_id_fkey(
          id,
          full_name,
          email
        ),
        created_by_user:users!jobs_created_by_fkey(
          id,
          full_name,
          email
        ),
        active_tasks:job_tasks(
          id,
          title,
          status,
          due_date,
          completed_at
        ),
        audit_history:stage_audit_log(
          id,
          from_stage_id,
          to_stage_id,
          trigger_source,
          response_value,
          duration_in_previous_stage_hours,
          created_at,
          from_stage:job_stages!stage_audit_log_from_stage_id_fkey(
            id,
            name,
            color
          ),
          to_stage:job_stages!stage_audit_log_to_stage_id_fkey(
            id,
            name,
            color
          ),
          triggered_by_user:users!stage_audit_log_triggered_by_fkey(
            id,
            full_name
          )
        )
      `)
      .eq('id', jobId)
      .single()

    if (jobError) {
      console.error('Error fetching job:', jobError)
      return NextResponse.json(
        { error: 'Job not found', details: jobError.message },
        { status: 404 }
      )
    }

    // Check if user has access to this job
    const { data: user } = await supabase
      .from('users')
      .select('company_id, role')
      .eq('id', session.user.id)
      .single()

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check access permissions
    const hasAccess = 
      user.role === 'site_admin' || 
      job.company_id === user.company_id

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      data: job
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}