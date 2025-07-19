import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - Enable sharing for an assignment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assignmentId = params.id
    const { expires_in_days = 30 } = await request.json()

    // Get user from request headers (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate the assignment exists and user has permission
    const { data: assignment, error: fetchError } = await supabase
      .from('job_assignments')
      .select(`
        *,
        job:jobs(
          title,
          company_id,
          created_by
        ),
        worker:workers(
          user_id,
          users(full_name, email)
        )
      `)
      .eq('id', assignmentId)
      .single()

    if (fetchError || !assignment) {
      return NextResponse.json({ 
        error: 'Assignment not found' 
      }, { status: 404 })
    }

    // Set expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expires_in_days)

    // Update assignment to enable sharing
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('job_assignments')
      .update({
        is_public: true,
        share_expires_at: expiresAt.toISOString(),
        shared_at: new Date().toISOString()
        // shared_by will be set when proper auth is implemented
      })
      .eq('id', assignmentId)
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
          company_id,
          companies(name)
        ),
        worker:workers(
          user_id,
          users(full_name, email, phone)
        )
      `)
      .single()

    if (updateError) {
      console.error('Error enabling assignment sharing:', updateError)
      return NextResponse.json({ 
        error: 'Failed to enable sharing' 
      }, { status: 500 })
    }

    return NextResponse.json({
      assignment: updatedAssignment,
      share_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/share/assignment/${updatedAssignment.share_token}`,
      expires_at: expiresAt.toISOString(),
      message: 'Assignment sharing enabled successfully'
    })

  } catch (error) {
    console.error('Assignment sharing error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE - Disable sharing for an assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const assignmentId = params.id

    // Get user from request headers (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Update assignment to disable sharing
    const { data: updatedAssignment, error: updateError } = await supabase
      .from('job_assignments')
      .update({
        is_public: false,
        share_token: null,
        share_expires_at: null,
        shared_at: null,
        shared_by: null
      })
      .eq('id', assignmentId)
      .select('id, is_public')
      .single()

    if (updateError) {
      console.error('Error disabling assignment sharing:', updateError)
      return NextResponse.json({ 
        error: 'Failed to disable sharing' 
      }, { status: 500 })
    }

    return NextResponse.json({
      assignment: updatedAssignment,
      message: 'Assignment sharing disabled successfully'
    })

  } catch (error) {
    console.error('Assignment sharing disable error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}