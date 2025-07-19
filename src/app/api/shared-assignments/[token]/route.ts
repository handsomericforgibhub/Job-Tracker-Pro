import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch shared assignment by token (public access)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const shareToken = params.token
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip
    const userAgent = request.headers.get('user-agent')

    // Fetch assignment by share token
    const { data: assignment, error: fetchError } = await supabase
      .from('job_assignments')
      .select(`
        *,
        job:jobs(
          title,
          description,
          location,
          address_components,
          latitude,
          longitude,
          start_date,
          end_date,
          status,
          client_name,
          companies(
            name,
            id
          )
        ),
        worker:workers(
          id,
          user_id,
          phone,
          emergency_contact_name,
          emergency_contact_phone,
          users(
            full_name,
            email
          )
        ),
        tasks:tasks(
          id,
          title,
          description,
          status,
          priority,
          due_date,
          estimated_hours
        )
      `)
      .eq('share_token', shareToken)
      .eq('is_public', true)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found or sharing has been disabled' 
      }, { status: 404 })
    }

    // Check if sharing has expired
    if (assignment.share_expires_at && new Date(assignment.share_expires_at) < new Date()) {
      return NextResponse.json({ 
        error: 'Sharing link has expired' 
      }, { status: 410 })
    }

    // Log access for security purposes
    try {
      await supabase
        .from('assignment_access_logs')
        .insert({
          assignment_id: assignment.id,
          share_token: shareToken,
          accessed_by_worker_id: assignment.worker_id,
          access_type: 'view',
          client_ip: clientIP,
          user_agent: userAgent
        })
    } catch (logError) {
      console.error('Error logging assignment access:', logError)
      // Don't fail the request if logging fails
    }

    // Format the response for the public view
    const publicAssignment = {
      id: assignment.id,
      role: assignment.role,
      assigned_date: assignment.assigned_date,
      job: {
        title: assignment.job.title,
        description: assignment.job.description,
        location: assignment.job.location,
        address_components: assignment.job.address_components,
        latitude: assignment.job.latitude,
        longitude: assignment.job.longitude,
        start_date: assignment.job.start_date,
        end_date: assignment.job.end_date,
        status: assignment.job.status,
        client_name: assignment.job.client_name,
        company: {
          name: assignment.job.companies?.name
        }
      },
      worker: {
        name: assignment.worker?.users?.full_name,
        email: assignment.worker?.users?.email,
        phone: assignment.worker?.phone,
        emergency_contact: assignment.worker?.emergency_contact_name ? {
          name: assignment.worker.emergency_contact_name,
          phone: assignment.worker.emergency_contact_phone
        } : null
      },
      tasks: assignment.tasks || [],
      shared_at: assignment.shared_at,
      expires_at: assignment.share_expires_at
    }

    return NextResponse.json({
      assignment: publicAssignment
    })

  } catch (error) {
    console.error('Shared assignment fetch error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Log worker interaction with shared assignment
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const shareToken = params.token
    const { action, notes } = await request.json()
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    request.ip
    const userAgent = request.headers.get('user-agent')

    // Validate action type
    const validActions = ['view', 'download', 'update']
    if (!validActions.includes(action)) {
      return NextResponse.json({ 
        error: 'Invalid action type' 
      }, { status: 400 })
    }

    // Fetch assignment to ensure token is valid
    const { data: assignment, error: fetchError } = await supabase
      .from('job_assignments')
      .select('id, worker_id, is_public, share_expires_at')
      .eq('share_token', shareToken)
      .eq('is_public', true)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found or sharing has been disabled' 
      }, { status: 404 })
    }

    // Check if sharing has expired
    if (assignment.share_expires_at && new Date(assignment.share_expires_at) < new Date()) {
      return NextResponse.json({ 
        error: 'Sharing link has expired' 
      }, { status: 410 })
    }

    // Log the action
    const { error: logError } = await supabase
      .from('assignment_access_logs')
      .insert({
        assignment_id: assignment.id,
        share_token: shareToken,
        accessed_by_worker_id: assignment.worker_id,
        access_type: action,
        client_ip: clientIP,
        user_agent: userAgent
      })

    if (logError) {
      console.error('Error logging assignment action:', logError)
      return NextResponse.json({ 
        error: 'Failed to log action' 
      }, { status: 500 })
    }

    return NextResponse.json({
      message: `Action '${action}' logged successfully`
    })

  } catch (error) {
    console.error('Assignment action logging error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}