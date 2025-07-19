import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const breakEntrySchema = z.object({
  time_entry_id: z.string().uuid(),
  worker_id: z.string().uuid(),
  break_type: z.enum(['lunch', 'general', 'smoke', 'personal', 'rest']).default('general'),
  start_time: z.string(),
  end_time: z.string().optional(),
  is_paid: z.boolean().default(false),
  notes: z.string().optional(),
  location: z.string().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
})

// GET - Fetch break entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const time_entry_id = searchParams.get('time_entry_id')
    const worker_id = searchParams.get('worker_id')
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')

    let query = supabase
      .from('break_entries')
      .select(`
        *,
        time_entry:time_entries(id, job_id, task_id),
        worker:workers(id, first_name, last_name)
      `)
      .order('start_time', { ascending: false })

    if (time_entry_id) query = query.eq('time_entry_id', time_entry_id)
    if (worker_id) query = query.eq('worker_id', worker_id)
    if (start_date) query = query.gte('start_time', start_date)
    if (end_date) query = query.lte('start_time', end_date)

    const { data: breakEntries, error } = await query

    if (error) {
      console.error('Error fetching break entries:', error)
      return NextResponse.json({ error: 'Failed to fetch break entries' }, { status: 500 })
    }

    return NextResponse.json({
      break_entries: breakEntries || []
    })

  } catch (error) {
    console.error('Get break entries error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Start a break
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = breakEntrySchema.parse(body)

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify time entry exists and belongs to worker
    const { data: timeEntry, error: timeEntryError } = await supabase
      .from('time_entries')
      .select('id, worker_id, end_time')
      .eq('id', validatedData.time_entry_id)
      .eq('worker_id', validatedData.worker_id)
      .single()

    if (timeEntryError || !timeEntry) {
      return NextResponse.json({ 
        error: 'Time entry not found or access denied' 
      }, { status: 404 })
    }

    // Check if time entry is still active (no end_time)
    if (timeEntry.end_time) {
      return NextResponse.json({ 
        error: 'Cannot start break on completed time entry' 
      }, { status: 400 })
    }

    // Check if worker already has an active break
    const { data: activeBreak, error: activeBreakError } = await supabase
      .from('break_entries')
      .select('id')
      .eq('worker_id', validatedData.worker_id)
      .is('end_time', null)
      .maybeSingle()

    if (activeBreakError) {
      console.error('Error checking active break:', activeBreakError)
      return NextResponse.json({ 
        error: 'Failed to check active break' 
      }, { status: 500 })
    }

    if (activeBreak) {
      return NextResponse.json({ 
        error: 'Worker already has an active break',
        active_break_id: activeBreak.id
      }, { status: 400 })
    }

    // Create break entry
    const { data: breakEntry, error: insertError } = await supabase
      .from('break_entries')
      .insert(validatedData)
      .select(`
        *,
        time_entry:time_entries(id, job_id, task_id),
        worker:workers(id, first_name, last_name)
      `)
      .single()

    if (insertError) {
      console.error('Error creating break entry:', insertError)
      return NextResponse.json({ error: 'Failed to start break' }, { status: 500 })
    }

    return NextResponse.json({
      break_entry: breakEntry,
      message: 'Break started successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Start break error:', error)
    
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

// PUT - End a break
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, end_time, notes, location, gps_lat, gps_lng } = z.object({
      id: z.string().uuid(),
      end_time: z.string(),
      notes: z.string().optional(),
      location: z.string().optional(),
      gps_lat: z.number().optional(),
      gps_lng: z.number().optional(),
    }).parse(body)

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if break entry exists and is active
    const { data: existingBreak, error: fetchError } = await supabase
      .from('break_entries')
      .select('*, time_entry:time_entries(worker_id)')
      .eq('id', id)
      .is('end_time', null)
      .single()

    if (fetchError || !existingBreak) {
      return NextResponse.json({ 
        error: 'Active break entry not found' 
      }, { status: 404 })
    }

    // Calculate break duration
    const startTime = new Date(existingBreak.start_time)
    const endTimeDate = new Date(end_time)
    const duration_minutes = Math.floor((endTimeDate.getTime() - startTime.getTime()) / (1000 * 60))

    // Update break entry
    const { data: breakEntry, error: updateError } = await supabase
      .from('break_entries')
      .update({
        end_time,
        duration_minutes,
        notes: notes || existingBreak.notes,
        location: location || existingBreak.location,
        gps_lat: gps_lat || existingBreak.gps_lat,
        gps_lng: gps_lng || existingBreak.gps_lng,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        time_entry:time_entries(id, job_id, task_id),
        worker:workers(id, first_name, last_name)
      `)
      .single()

    if (updateError) {
      console.error('Error ending break:', updateError)
      return NextResponse.json({ error: 'Failed to end break' }, { status: 500 })
    }

    // Update the parent time entry's break duration
    const { data: allBreaks } = await supabase
      .from('break_entries')
      .select('duration_minutes')
      .eq('time_entry_id', existingBreak.time_entry_id)
      .not('duration_minutes', 'is', null)

    const totalBreakMinutes = allBreaks?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0

    await supabase
      .from('time_entries')
      .update({ break_duration_minutes: totalBreakMinutes })
      .eq('id', existingBreak.time_entry_id)

    return NextResponse.json({
      break_entry: breakEntry,
      total_break_minutes: totalBreakMinutes,
      message: 'Break ended successfully'
    })

  } catch (error) {
    console.error('End break error:', error)
    
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