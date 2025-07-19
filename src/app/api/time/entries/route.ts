import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const timeEntrySchema = z.object({
  worker_id: z.string().uuid(),
  job_id: z.string().uuid(),
  task_id: z.string().uuid().optional(),
  start_time: z.string(),
  end_time: z.string().optional(),
  description: z.string().optional(),
  entry_type: z.enum(['regular', 'overtime', 'break', 'travel']).default('regular'),
  start_location: z.string().optional(),
  end_location: z.string().optional(),
  start_gps_lat: z.number().optional(),
  start_gps_lng: z.number().optional(),
  end_gps_lat: z.number().optional(),
  end_gps_lng: z.number().optional(),
})

const timeEntryUpdateSchema = timeEntrySchema.partial().extend({
  id: z.string().uuid(),
})

// GET - Fetch time entries with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const worker_id = searchParams.get('worker_id')
    const job_id = searchParams.get('job_id')
    const task_id = searchParams.get('task_id')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('time_entries')
      .select('*')
      .order('start_time', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (worker_id) query = query.eq('worker_id', worker_id)
    if (job_id) query = query.eq('job_id', job_id)
    if (task_id) query = query.eq('task_id', task_id)
    if (status) query = query.eq('status', status)
    if (start_date) query = query.gte('start_time', start_date)
    if (end_date) query = query.lte('start_time', end_date)

    const { data: timeEntries, error } = await query

    if (error) {
      console.error('Error fetching time entries:', error)
      return NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 })
    }

    return NextResponse.json({
      time_entries: timeEntries || [],
      pagination: {
        total: timeEntries?.length || 0,
        limit,
        offset,
        has_more: false
      }
    })

  } catch (error) {
    console.error('Get time entries error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Create new time entry
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting time entry creation...')
    const body = await request.json()
    console.log('📥 Received request body:', JSON.stringify(body, null, 2))
    
    const validatedData = timeEntrySchema.parse(body)
    console.log('✅ Data validation passed:', JSON.stringify(validatedData, null, 2))

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    console.log('🔑 Auth header:', authHeader)
    if (!authHeader) {
      console.log('❌ No auth header provided')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Extract user ID from Bearer token (currently just the user ID)
    const userId = authHeader.replace('Bearer ', '')
    console.log('👤 Extracted user ID:', userId)
    
    // Validate user exists
    console.log('🔍 Validating user exists in users table...')
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()
    
    if (userError || !user) {
      console.error('❌ User validation failed:', userError?.message)
      return NextResponse.json({ error: 'Invalid user authentication' }, { status: 401 })
    }
    console.log('✅ User validation passed')

    // Get worker details for company_id and hourly rate
    console.log('👷 Fetching worker details for ID:', validatedData.worker_id)
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('*, company_id')
      .eq('id', validatedData.worker_id)
      .single()

    if (workerError) {
      console.error('❌ Worker fetch error:', workerError)
      return NextResponse.json({ error: 'Worker not found', details: workerError.message }, { status: 404 })
    }
    if (!worker) {
      console.error('❌ Worker not found for ID:', validatedData.worker_id)
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }
    console.log('✅ Worker found:', { id: worker.id, company_id: worker.company_id, hourly_rate: worker.hourly_rate })

    // Validate job exists and worker has access
    console.log('💼 Fetching job details for ID:', validatedData.job_id, 'company:', worker.company_id)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, company_id')
      .eq('id', validatedData.job_id)
      .eq('company_id', worker.company_id)
      .single()

    if (jobError) {
      console.error('❌ Job fetch error:', jobError)
      return NextResponse.json({ error: 'Job not found or access denied', details: jobError.message }, { status: 404 })
    }
    if (!job) {
      console.error('❌ Job not found for ID:', validatedData.job_id)
      return NextResponse.json({ error: 'Job not found or access denied' }, { status: 404 })
    }
    console.log('✅ Job found:', { id: job.id, company_id: job.company_id })

    // Validate task if provided
    if (validatedData.task_id) {
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('id, job_id')
        .eq('id', validatedData.task_id)
        .eq('job_id', validatedData.job_id)
        .single()

      if (taskError || !task) {
        return NextResponse.json({ error: 'Task not found or not associated with job' }, { status: 404 })
      }
    }

    // Calculate duration if end_time is provided
    let duration_minutes = null
    if (validatedData.end_time) {
      const startTime = new Date(validatedData.start_time)
      const endTime = new Date(validatedData.end_time)
      duration_minutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))
    }

    // Check for overtime
    const today = new Date(validatedData.start_time).toISOString().split('T')[0]
    const { data: todayEntries } = await supabase
      .from('time_entries')
      .select('duration_minutes')
      .eq('worker_id', validatedData.worker_id)
      .gte('start_time', `${today}T00:00:00Z`)
      .not('duration_minutes', 'is', null)

    const todayTotalMinutes = todayEntries?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0
    const projectedTotalMinutes = todayTotalMinutes + (duration_minutes || 0)
    const isOvertime = projectedTotalMinutes > (8 * 60) // More than 8 hours

    const entryType = isOvertime && validatedData.entry_type === 'regular' ? 'overtime' : validatedData.entry_type
    const overtimeRate = isOvertime ? (worker.hourly_rate || 0) * 1.5 : null

    // Create time entry
    const timeEntryData = {
      ...validatedData,
      duration_minutes,
      entry_type: entryType,
      break_duration_minutes: 0,
      hourly_rate: worker.hourly_rate || null,
      overtime_rate: overtimeRate,
      total_cost: duration_minutes ? 
        ((duration_minutes / 60) * (isOvertime ? overtimeRate : (worker.hourly_rate || 0))) : null,
      status: 'pending',
      company_id: worker.company_id,
      created_by: userId, // Use authenticated user ID instead of worker ID
    }
    
    console.log('💾 Preparing to insert time entry data:', JSON.stringify(timeEntryData, null, 2))

    const { data: timeEntry, error: insertError } = await supabase
      .from('time_entries')
      .insert(timeEntryData)
      .select('*')
      .single()

    if (insertError) {
      console.error('❌ Database insertion error:', insertError)
      console.error('❌ Insert error details:', {
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        code: insertError.code
      })
      return NextResponse.json({ 
        error: 'Failed to create time entry', 
        details: insertError.message,
        code: insertError.code 
      }, { status: 500 })
    }
    
    console.log('✅ Time entry created successfully:', timeEntry?.id)

    return NextResponse.json({
      time_entry: timeEntry,
      message: 'Time entry created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create time entry error:', error)
    
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

// PUT - Update time entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updateData } = timeEntryUpdateSchema.parse(body)

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if time entry exists and get current data
    const { data: existingEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('*, worker:workers(company_id)')
      .eq('id', id)
      .single()

    if (fetchError || !existingEntry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    // Check if entry can be edited (not approved)
    if (existingEntry.status === 'approved') {
      return NextResponse.json({ 
        error: 'Cannot edit approved time entry' 
      }, { status: 400 })
    }

    // Calculate duration if times are updated
    let duration_minutes = existingEntry.duration_minutes
    if (updateData.start_time || updateData.end_time) {
      const startTime = new Date(updateData.start_time || existingEntry.start_time)
      const endTime = updateData.end_time ? new Date(updateData.end_time) : 
                      existingEntry.end_time ? new Date(existingEntry.end_time) : null
      
      if (endTime) {
        duration_minutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60))
      }
    }

    // Recalculate costs if duration changed
    let total_cost = existingEntry.total_cost
    if (duration_minutes !== existingEntry.duration_minutes && existingEntry.hourly_rate) {
      const rate = existingEntry.entry_type === 'overtime' ? 
        (existingEntry.overtime_rate || existingEntry.hourly_rate) : 
        existingEntry.hourly_rate
      total_cost = ((duration_minutes || 0) / 60) * rate
    }

    const finalUpdateData = {
      ...updateData,
      duration_minutes,
      total_cost,
      updated_at: new Date().toISOString(),
    }

    const { data: timeEntry, error: updateError } = await supabase
      .from('time_entries')
      .update(finalUpdateData)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating time entry:', updateError)
      return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
    }

    return NextResponse.json({
      time_entry: timeEntry,
      message: 'Time entry updated successfully'
    })

  } catch (error) {
    console.error('Update time entry error:', error)
    
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