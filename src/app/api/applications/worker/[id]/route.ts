import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch specific worker application
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const applicationId = params.id

    const { data: application, error } = await supabase
      .from('worker_applications')
      .select(`
        *,
        reviewed_by_user:users!worker_applications_reviewed_by_fkey(
          full_name,
          email
        ),
        company:companies(
          name
        )
      `)
      .eq('id', applicationId)
      .single()

    if (error) {
      console.error('Error fetching worker application:', error)
      return NextResponse.json({ 
        error: 'Application not found' 
      }, { status: 404 })
    }

    return NextResponse.json({
      application
    })

  } catch (error) {
    console.error('Get worker application error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// PATCH - Update worker application status (approve/reject)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const applicationId = params.id
    const updateData = await request.json()

    // Get user from request headers (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'withdrawn']
    if (updateData.status && !validStatuses.includes(updateData.status)) {
      return NextResponse.json({ 
        error: 'Invalid status' 
      }, { status: 400 })
    }

    // First, get the current application
    const { data: currentApplication, error: fetchError } = await supabase
      .from('worker_applications')
      .select('*')
      .eq('id', applicationId)
      .single()

    if (fetchError || !currentApplication) {
      return NextResponse.json({ 
        error: 'Application not found' 
      }, { status: 404 })
    }

    // Prepare update data
    const updateFields: any = {
      updated_at: new Date().toISOString()
    }

    if (updateData.status) {
      updateFields.status = updateData.status
      updateFields.reviewed_at = new Date().toISOString()
      // updateFields.reviewed_by = user.id; // Set when proper auth is implemented
    }

    if (updateData.reviewer_notes) {
      updateFields.reviewer_notes = updateData.reviewer_notes
    }

    if (updateData.rejection_reason) {
      updateFields.rejection_reason = updateData.rejection_reason
    }

    // Update the application
    const { data: updatedApplication, error: updateError } = await supabase
      .from('worker_applications')
      .update(updateFields)
      .eq('id', applicationId)
      .select(`
        *,
        reviewed_by_user:users!worker_applications_reviewed_by_fkey(
          full_name,
          email
        ),
        company:companies(
          name
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating worker application:', updateError)
      return NextResponse.json({ 
        error: 'Failed to update application' 
      }, { status: 500 })
    }

    // If approved, create a worker record
    if (updateData.status === 'approved' && currentApplication.status !== 'approved') {
      try {
        // Create user account first
        const { data: newUser, error: userError } = await supabase
          .from('users')
          .insert({
            email: currentApplication.email,
            full_name: currentApplication.full_name,
            role: 'worker',
            company_id: currentApplication.company_id
          })
          .select('id')
          .single()

        if (userError) {
          console.error('Error creating user for approved application:', userError)
          // Don't fail the approval, just log the error
        } else {
          // Create worker record
          const workerData = {
            user_id: newUser.id,
            company_id: currentApplication.company_id,
            phone: currentApplication.phone,
            emergency_contact_name: currentApplication.emergency_contact_name,
            emergency_contact_phone: currentApplication.emergency_contact_phone,
            address: currentApplication.address,
            hourly_rate: currentApplication.desired_hourly_rate,
            employment_status: 'active',
            notes: `Hired from application on ${new Date().toLocaleDateString()}`
          }

          const { error: workerError } = await supabase
            .from('workers')
            .insert(workerData)

          if (workerError) {
            console.error('Error creating worker record for approved application:', workerError)
            // Don't fail the approval, just log the error
          }

          // TODO: Create worker skills and licenses from application data
          // This would parse the JSON arrays and create records in worker_skills and worker_licenses tables
        }
      } catch (approvalError) {
        console.error('Error processing approval:', approvalError)
        // Continue with the response even if worker creation fails
      }
    }

    // TODO: Send notification email to applicant about status change
    // This would integrate with email service

    return NextResponse.json({
      application: updatedApplication,
      message: `Application ${updateData.status} successfully`
    })

  } catch (error) {
    console.error('Update worker application error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE - Delete worker application
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const applicationId = params.id

    // Get user from request headers (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('worker_applications')
      .delete()
      .eq('id', applicationId)

    if (error) {
      console.error('Error deleting worker application:', error)
      return NextResponse.json({ 
        error: 'Failed to delete application' 
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Application deleted successfully'
    })

  } catch (error) {
    console.error('Delete worker application error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}