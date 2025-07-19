import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const approvalSchema = z.object({
  time_entry_id: z.string().uuid(),
  approval_status: z.enum(['approved', 'rejected', 'changes_requested']),
  approver_notes: z.string().optional(),
  requested_changes: z.string().optional(),
  approved_start_time: z.string().optional(),
  approved_end_time: z.string().optional(),
})

const bulkApprovalSchema = z.object({
  time_entry_ids: z.array(z.string().uuid()),
  approval_status: z.enum(['approved', 'rejected']),
  approver_notes: z.string().optional(),
})

// GET - Fetch time approvals with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const worker_id = searchParams.get('worker_id')
    const approver_id = searchParams.get('approver_id')
    const status = searchParams.get('status')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('time_approvals')
      .select(`
        *,
        time_entry:time_entries(
          *,
          worker:workers(id, first_name, last_name),
          job:jobs(id, title),
          task:tasks(id, title)
        ),
        approver:users!time_approvals_approver_id_fkey(full_name, email),
        worker:workers(id, first_name, last_name, employee_id)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (worker_id) query = query.eq('worker_id', worker_id)
    if (approver_id) query = query.eq('approver_id', approver_id)
    if (status) query = query.eq('approval_status', status)
    if (start_date) query = query.gte('created_at', start_date)
    if (end_date) query = query.lte('created_at', end_date)

    const { data: approvals, error } = await query

    if (error) {
      console.error('Error fetching time approvals:', error)
      return NextResponse.json({ error: 'Failed to fetch time approvals' }, { status: 500 })
    }

    // Get count for pagination
    let countQuery = supabase
      .from('time_approvals')
      .select('*', { count: 'exact', head: true })

    if (worker_id) countQuery = countQuery.eq('worker_id', worker_id)
    if (approver_id) countQuery = countQuery.eq('approver_id', approver_id)
    if (status) countQuery = countQuery.eq('approval_status', status)
    if (start_date) countQuery = countQuery.gte('created_at', start_date)
    if (end_date) countQuery = countQuery.lte('created_at', end_date)

    const { count: totalCount } = await countQuery

    return NextResponse.json({
      approvals: approvals || [],
      pagination: {
        total: totalCount || 0,
        limit,
        offset,
        has_more: (totalCount || 0) > offset + limit
      }
    })

  } catch (error) {
    console.error('Get time approvals error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Create time approval or approve time entry
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting approval creation...')
    const body = await request.json()
    console.log('📥 Received approval request:', JSON.stringify(body, null, 2))
    
    // Check if this is a bulk approval
    if (body.time_entry_ids) {
      return handleBulkApproval(request, body)
    }

    const validatedData = approvalSchema.parse(body)
    console.log('✅ Approval data validation passed:', validatedData)

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Extract user ID from Bearer token (currently just the user ID)
    const approver_id = authHeader.replace('Bearer ', '')
    console.log('👤 Extracted approver ID:', approver_id)
    
    // Validate user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', approver_id)
      .single()
    
    if (userError || !user) {
      console.error('❌ User validation failed:', userError?.message)
      return NextResponse.json({ error: 'Invalid user authentication' }, { status: 401 })
    }

    // Verify time entry exists
    console.log('🔍 Fetching time entry details...')
    const { data: timeEntry, error: timeEntryError } = await supabase
      .from('time_entries')
      .select(`
        *,
        worker:workers(
          id,
          company_id,
          users!inner(
            full_name,
            email
          )
        )
      `)
      .eq('id', validatedData.time_entry_id)
      .single()

    if (timeEntryError || !timeEntry) {
      return NextResponse.json({ 
        error: 'Time entry not found' 
      }, { status: 404 })
    }

    // Check if already approved/rejected
    if (timeEntry.status === 'approved') {
      return NextResponse.json({ 
        error: 'Time entry is already approved' 
      }, { status: 400 })
    }

    // Start transaction-like operations
    const approvalData = {
      time_entry_id: validatedData.time_entry_id,
      approver_id,
      worker_id: timeEntry.worker_id,
      approval_status: validatedData.approval_status,
      approval_date: new Date().toISOString(),
      approver_notes: validatedData.approver_notes || null,
      requested_changes: validatedData.requested_changes || null,
      original_start_time: timeEntry.start_time,
      original_end_time: timeEntry.end_time,
      approved_start_time: validatedData.approved_start_time || timeEntry.start_time,
      approved_end_time: validatedData.approved_end_time || timeEntry.end_time,
      company_id: timeEntry.worker.company_id,
    }

    // Create approval record
    console.log('💾 Preparing to insert approval data:', JSON.stringify(approvalData, null, 2))
    const { data: approval, error: approvalError } = await supabase
      .from('time_approvals')
      .insert(approvalData)
      .select(`
        *,
        time_entry:time_entries(*),
        approver:users!time_approvals_approver_id_fkey(full_name, email),
        worker:workers(
          id,
          users!inner(
            full_name,
            email
          )
        )
      `)
      .single()

    if (approvalError) {
      console.error('❌ Error creating approval:', approvalError)
      console.error('❌ Approval error details:', {
        message: approvalError.message,
        details: approvalError.details,
        hint: approvalError.hint,
        code: approvalError.code
      })
      return NextResponse.json({ 
        error: 'Failed to create approval', 
        details: approvalError.message 
      }, { status: 500 })
    }
    
    console.log('✅ Approval created successfully:', approval?.id)

    // Update time entry status and approved times if different
    const timeEntryUpdates: any = {
      status: validatedData.approval_status === 'approved' ? 'approved' : 
              validatedData.approval_status === 'rejected' ? 'rejected' : 'pending',
      approved_by: approver_id,
      approved_at: new Date().toISOString(),
    }

    // If times were adjusted, update them
    if (validatedData.approved_start_time && validatedData.approved_start_time !== timeEntry.start_time) {
      timeEntryUpdates.start_time = validatedData.approved_start_time
    }
    if (validatedData.approved_end_time && validatedData.approved_end_time !== timeEntry.end_time) {
      timeEntryUpdates.end_time = validatedData.approved_end_time
    }

    // Recalculate duration and cost if times changed
    if (timeEntryUpdates.start_time || timeEntryUpdates.end_time) {
      const startTime = new Date(timeEntryUpdates.start_time || timeEntry.start_time)
      const endTime = new Date(timeEntryUpdates.end_time || timeEntry.end_time)
      const newDuration = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))
      
      timeEntryUpdates.duration_minutes = newDuration
      if (timeEntry.hourly_rate) {
        const rate = timeEntry.entry_type === 'overtime' ? 
          (timeEntry.overtime_rate || timeEntry.hourly_rate) : timeEntry.hourly_rate
        timeEntryUpdates.total_cost = ((newDuration - (timeEntry.break_duration_minutes || 0)) / 60) * rate
      }
    }

    const { data: updatedTimeEntry, error: updateError } = await supabase
      .from('time_entries')
      .update(timeEntryUpdates)
      .eq('id', validatedData.time_entry_id)
      .select(`
        *,
        worker:workers(
          id,
          users!inner(
            full_name,
            email
          )
        ),
        job:jobs(id, title),
        task:tasks(id, title),
        approved_by_user:users!time_entries_approved_by_fkey(full_name, email)
      `)
      .single()

    if (updateError) {
      console.error('Error updating time entry:', updateError)
      return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
    }

    return NextResponse.json({
      approval,
      time_entry: updatedTimeEntry,
      message: `Time entry ${validatedData.approval_status} successfully`
    }, { status: 201 })

  } catch (error) {
    console.error('Create approval error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// Helper function for bulk approvals
async function handleBulkApproval(request: NextRequest, body: any) {
  try {
    const { time_entry_ids, approval_status, approver_notes } = bulkApprovalSchema.parse(body)

    // Get approver ID from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const approver_id = authHeader.replace('Bearer ', '')

    const results = []
    const errors = []

    for (const time_entry_id of time_entry_ids) {
      try {
        // Get time entry
        const { data: timeEntry, error: timeEntryError } = await supabase
          .from('time_entries')
          .select('*, worker:workers(company_id)')
          .eq('id', time_entry_id)
          .single()

        if (timeEntryError || !timeEntry) {
          errors.push({ time_entry_id, error: 'Time entry not found' })
          continue
        }

        if (timeEntry.status === 'approved') {
          errors.push({ time_entry_id, error: 'Already approved' })
          continue
        }

        // Create approval
        const approvalData = {
          time_entry_id,
          approver_id,
          worker_id: timeEntry.worker_id,
          approval_status,
          approval_date: new Date().toISOString(),
          approver_notes: approver_notes || null,
          original_start_time: timeEntry.start_time,
          original_end_time: timeEntry.end_time,
          approved_start_time: timeEntry.start_time,
          approved_end_time: timeEntry.end_time,
          company_id: timeEntry.worker.company_id,
        }

        const { data: approval, error: approvalError } = await supabase
          .from('time_approvals')
          .insert(approvalData)
          .select()
          .single()

        if (approvalError) {
          errors.push({ time_entry_id, error: 'Failed to create approval' })
          continue
        }

        // Update time entry
        const { error: updateError } = await supabase
          .from('time_entries')
          .update({
            status: approval_status === 'approved' ? 'approved' : 'rejected',
            approved_by: approver_id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', time_entry_id)

        if (updateError) {
          errors.push({ time_entry_id, error: 'Failed to update time entry' })
          continue
        }

        results.push({ time_entry_id, approval_id: approval.id })

      } catch (error) {
        errors.push({ time_entry_id, error: 'Processing failed' })
      }
    }

    return NextResponse.json({
      successful: results,
      failed: errors,
      message: `Processed ${results.length} approvals, ${errors.length} errors`
    })

  } catch (error) {
    console.error('Bulk approval error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid request data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}