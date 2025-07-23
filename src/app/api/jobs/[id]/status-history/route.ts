import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { JobStatusTimeline } from '@/lib/types'
import { 
  createLegacyStatusHistory,
  createEnhancedStatusTimeline 
} from '@/lib/integrations/gantt-integration'

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
    const { searchParams } = new URL(request.url)
    const enhanced = searchParams.get('enhanced') === 'true'

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

    console.log('🔄 Getting status history for job:', jobId, { enhanced })

    // Get job data with stage information
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        id,
        title,
        status,
        start_date,
        end_date,
        created_at,
        updated_at,
        created_by,
        current_stage_id,
        stage_entered_at,
        job_type,
        company_id,
        current_stage:job_stages!current_stage_id (
          id,
          name,
          color,
          maps_to_status,
          stage_type
        )
      `)
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

    if (enhanced) {
      // Return enhanced timeline with stage information
      const enhancedTimeline = createEnhancedStatusTimeline(job, [])
      
      // Try to get stage audit log for enhanced timeline
      const { data: auditLog } = await supabase
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
          duration_in_previous_stage_hours,
          created_at,
          from_stage:job_stages!from_stage_id (
            id,
            name,
            color,
            maps_to_status
          ),
          to_stage:job_stages!to_stage_id (
            id,
            name,
            color,
            maps_to_status
          ),
          triggered_by_user:users!triggered_by (
            id,
            full_name,
            email
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })

      if (auditLog && auditLog.length > 0) {
        // Convert audit log to individual stage history entries (not grouped by status)
        const stageHistory: JobStatusHistory[] = []
        
        // Add initial stage entry (job creation) - use the from_stage of the first transition
        const initialStage = auditLog[0]?.from_stage
        if (initialStage) {
          stageHistory.push({
            id: `initial-${job.id}`,
            job_id: job.id,
            status: initialStage.name, // Use stage name for proper segment identification
            changed_at: job.created_at,
            changed_by: job.created_by,
            changed_by_name: 'System',
            duration_days: 0,
            is_current: false,
            stage_id: initialStage.id,
            stage_name: initialStage.name
          })
        }

        // Add entry for each stage transition
        auditLog.forEach((audit, index) => {
          if (audit.to_stage) {
            stageHistory.push({
              id: audit.id,
              job_id: audit.job_id,
              status: audit.to_stage.name, // Use stage name as status for proper segment identification
              changed_at: audit.created_at,
              changed_by: audit.triggered_by || job.created_by,
              changed_by_name: audit.triggered_by_user?.full_name || 'System',
              duration_days: Math.round((audit.duration_in_previous_stage_hours || 0) / 24),
              is_current: index === auditLog.length - 1,
              stage_id: audit.to_stage.id,
              stage_name: audit.to_stage.name
            })
          }
        })

        const enhancedTimeline = {
          job_id: job.id,
          history: stageHistory,
          stage_details: {
            current_stage_name: job.current_stage?.name,
            current_stage_color: job.current_stage?.color,
            stages_completed: auditLog.length,
            total_stages: 12,
            stage_progress_percentage: Math.round((auditLog.length / 12) * 100)
          }
        }

        console.log('📊 Raw audit log for job:', jobId, auditLog.map(a => ({
          id: a.id,
          from_stage: a.from_stage?.name,
          to_stage: a.to_stage?.name, 
          created_at: a.created_at,
          duration_hours: a.duration_in_previous_stage_hours
        })))
        console.log('📊 Enhanced timeline with individual stages:', enhancedTimeline)
        return NextResponse.json(enhancedTimeline)
      }

      // Return fallback timeline if no audit log
      const fallbackTimeline = {
        job_id: job.id,
        history: [{
          id: `fallback-${job.id}`,
          job_id: job.id,
          status: job.status,
          changed_at: job.created_at,
          changed_by: job.created_by,
          changed_by_name: 'System',
          duration_days: 0,
          is_current: true,
          stage_id: job.current_stage_id,
          stage_name: job.current_stage?.name || 'Current Stage'
        }],
        stage_details: {
          current_stage_name: job.current_stage?.name,
          current_stage_color: job.current_stage?.color,
          stages_completed: 0,
          total_stages: 12,
          stage_progress_percentage: 0
        }
      }
      return NextResponse.json(fallbackTimeline)
    } else {
      // Return legacy status history for backward compatibility
      
      // First check if we have stage audit data
      const { data: auditLog } = await supabase
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
          duration_in_previous_stage_hours,
          created_at,
          from_stage:job_stages!from_stage_id (
            id,
            name,
            color,
            maps_to_status
          ),
          to_stage:job_stages!to_stage_id (
            id,
            name,
            color,
            maps_to_status
          ),
          triggered_by_user:users!triggered_by (
            id,
            full_name,
            email
          )
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: true })

      if (auditLog && auditLog.length > 0) {
        // Create legacy status history from stage audit log
        const legacyTimeline = createLegacyStatusHistory(job, auditLog)
        return NextResponse.json(legacyTimeline)
      } else {
        // Fall back to original logic for jobs without stage progression
        const { data: statusHistory, error: historyError } = await supabase
          .from('job_status_history')
          .select(`
            id,
            job_id,
            status,
            changed_at,
            changed_by,
            notes,
            duration_days,
            is_current,
            changed_by_user:users!changed_by (
              full_name,
              email
            )
          `)
          .eq('job_id', jobId)
          .order('changed_at', { ascending: true })

        if (historyError) {
          console.error('❌ Error fetching status history:', historyError)
          // Create a default history entry
          const defaultHistory = [{
            id: `default-${job.id}`,
            job_id: job.id,
            status: job.status,
            changed_at: job.created_at,
            changed_by: job.created_by,
            changed_by_name: 'System',
            notes: 'Job created',
            duration_days: 0,
            is_current: true
          }]

          return NextResponse.json({
            job_id: jobId,
            history: defaultHistory
          } as JobStatusTimeline)
        }

        const timeline: JobStatusTimeline = {
          job_id: jobId,
          history: statusHistory?.map(h => ({
            id: h.id,
            job_id: h.job_id,
            status: h.status,
            changed_at: h.changed_at,
            changed_by: h.changed_by,
            changed_by_name: h.changed_by_user?.full_name || 'Unknown',
            notes: h.notes,
            duration_days: h.duration_days,
            is_current: h.is_current
          })) || []
        }

        return NextResponse.json(timeline)
      }
    }

  } catch (error) {
    console.error('Error in status history API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { status, notes } = await request.json()

    // Validate status
    const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Get the current user from request headers (server-side auth)
    const authHeader = request.headers.get('authorization')
    console.log('🔍 Auth header:', authHeader ? 'Present' : 'Missing')
    
    if (!authHeader) {
      console.log('❌ No authorization header found')
      return NextResponse.json({ error: 'Unauthorized - No auth header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    console.log('🔍 Token:', token.substring(0, 50) + '...')
    
    // Create a server-side supabase client to verify the token
    const { createClient } = require('@supabase/supabase-js')
    const supabaseServer = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('🔍 Verifying token with Supabase...')
    const { data: { user }, error: userError } = await supabaseServer.auth.getUser(token)
    
    if (userError) {
      console.log('❌ User error:', userError)
      return NextResponse.json({ error: 'Unauthorized - Invalid token', details: userError.message }, { status: 401 })
    }
    
    if (!user) {
      console.log('❌ No user returned from token')
      return NextResponse.json({ error: 'Unauthorized - No user found' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.email)

    // Verify job exists and get current status
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('status')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if status is actually changing
    if (job.status === status) {
      return NextResponse.json({ error: 'Status is already set to this value' }, { status: 400 })
    }

    // Use the safe update function that handles RLS properly
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_job_status_safely', {
        p_job_id: jobId,
        p_new_status: status,
        p_user_id: user.id,
        p_notes: notes || null
      })

    if (updateError) {
      console.error('Error updating job status:', updateError)
      return NextResponse.json({ error: 'Failed to update job status: ' + updateError.message }, { status: 500 })
    }

    // Get the updated job data
    const { data: updatedJob, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError) {
      console.error('Error fetching updated job:', fetchError)
      return NextResponse.json({ error: 'Job updated but failed to fetch updated data' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      job_id: jobId,
      old_status: job.status,
      new_status: status,
      notes: notes || null,
      job: updatedJob,
      message: 'Job status updated successfully'
    })

  } catch (error) {
    console.error('Error in status change API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}