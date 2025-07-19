import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const jobId = params.id

    // Fetch job with enhanced details (TODO: Add proper authentication)
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