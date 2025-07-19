import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const checkInSchema = z.object({
  worker_id: z.string().uuid(),
  job_id: z.string().uuid(),
  location: z.string().optional(),
  gps_lat: z.number().optional(),
  gps_lng: z.number().optional(),
  gps_accuracy: z.number().optional(),
  gps_speed: z.number().nullable().optional(),
  gps_heading: z.number().nullable().optional(),
  location_verified: z.boolean().optional(),
  verification_distance: z.number().optional(),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      worker_id, 
      job_id, 
      location, 
      gps_lat, 
      gps_lng, 
      gps_accuracy, 
      gps_speed, 
      gps_heading, 
      location_verified, 
      verification_distance, 
      notes 
    } = checkInSchema.parse(body)

    // Get user from session (you may need to implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if worker is already checked in for today
    const today = new Date().toISOString().split('T')[0]
    const { data: existingCheckIn, error: checkError } = await supabase
      .from('worker_check_ins')
      .select('*')
      .eq('worker_id', worker_id)
      .gte('check_in_time', `${today}T00:00:00Z`)
      .is('check_out_time', null)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking existing check-in:', checkError)
      return NextResponse.json({ error: 'Failed to check existing check-in' }, { status: 500 })
    }

    if (existingCheckIn) {
      return NextResponse.json({ 
        error: 'Worker is already checked in',
        existing_check_in: existingCheckIn 
      }, { status: 400 })
    }

    // Get worker details for hourly rate
    const { data: worker, error: workerError } = await supabase
      .from('workers')
      .select('*, company_id')
      .eq('id', worker_id)
      .single()

    if (workerError || !worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 })
    }

    // Create check-in record
    const checkInData = {
      worker_id,
      job_id,
      check_in_time: new Date().toISOString(),
      location: location || null,
      gps_accuracy: gps_accuracy || null,
      notes: notes || null,
      break_duration: 0,
      is_approved: false,
    }

    const { data: checkIn, error: insertError } = await supabase
      .from('worker_check_ins')
      .insert(checkInData)
      .select(`
        *,
        worker:workers(id, first_name, last_name, hourly_rate),
        job:jobs(id, title, location)
      `)
      .single()

    if (insertError) {
      console.error('Error creating check-in:', insertError)
      return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 })
    }

    // Create initial time entry
    const timeEntryData = {
      worker_id,
      job_id,
      check_in_id: checkIn.id,
      start_time: checkInData.check_in_time,
      entry_type: 'regular',
      start_location: location || null,
      start_gps_lat: gps_lat || null,
      start_gps_lng: gps_lng || null,
      gps_speed: gps_speed || null,
      gps_heading: gps_heading || null,
      location_verified: location_verified || false,
      verification_distance: verification_distance || null,
      hourly_rate: worker.hourly_rate || null,
      status: 'pending',
      company_id: worker.company_id,
      created_by: worker_id, // In a real app, this would be the authenticated user ID
      break_duration_minutes: 0,
    }

    const { data: timeEntry, error: timeEntryError } = await supabase
      .from('time_entries')
      .insert(timeEntryData)
      .select(`
        *,
        worker:workers(id, first_name, last_name),
        job:jobs(id, title),
        check_in:worker_check_ins(*)
      `)
      .single()

    if (timeEntryError) {
      console.error('Error creating time entry:', timeEntryError)
      // Rollback check-in if time entry creation fails
      await supabase
        .from('worker_check_ins')
        .delete()
        .eq('id', checkIn.id)
      
      return NextResponse.json({ error: 'Failed to create time entry' }, { status: 500 })
    }

    return NextResponse.json({
      check_in: checkIn,
      time_entry: timeEntry,
      message: 'Successfully checked in'
    })

  } catch (error) {
    console.error('Check-in error:', error)
    
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

// GET endpoint to check current check-in status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const worker_id = searchParams.get('worker_id')

    if (!worker_id) {
      return NextResponse.json({ error: 'worker_id is required' }, { status: 400 })
    }

    // Get today's check-in status
    const today = new Date().toISOString().split('T')[0]
    const { data: checkIn, error } = await supabase
      .from('worker_check_ins')
      .select(`
        *,
        worker:workers(id, first_name, last_name, hourly_rate),
        job:jobs(id, title, location)
      `)
      .eq('worker_id', worker_id)
      .gte('check_in_time', `${today}T00:00:00Z`)
      .order('check_in_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      console.error('Error fetching check-in status:', error)
      return NextResponse.json({ error: 'Failed to fetch check-in status' }, { status: 500 })
    }

    // Get current time entry if checked in
    let currentTimeEntry = null
    if (checkIn && !checkIn.check_out_time) {
      const { data: timeEntry } = await supabase
        .from('time_entries')
        .select(`
          *,
          break_entries(*)
        `)
        .eq('check_in_id', checkIn.id)
        .is('end_time', null)
        .maybeSingle()

      currentTimeEntry = timeEntry
    }

    // Calculate daily totals
    const { data: dailyEntries } = await supabase
      .from('time_entries')
      .select('duration_minutes, entry_type, break_duration_minutes')
      .eq('worker_id', worker_id)
      .gte('start_time', `${today}T00:00:00Z`)
      .not('duration_minutes', 'is', null)

    const dailyStats = dailyEntries?.reduce((acc, entry) => {
      const hours = (entry.duration_minutes || 0) / 60
      const breakHours = (entry.break_duration_minutes || 0) / 60
      
      if (entry.entry_type === 'overtime') {
        acc.overtime_hours += hours
      } else {
        acc.regular_hours += hours
      }
      acc.break_hours += breakHours
      return acc
    }, { regular_hours: 0, overtime_hours: 0, break_hours: 0 }) || { regular_hours: 0, overtime_hours: 0, break_hours: 0 }

    return NextResponse.json({
      is_clocked_in: checkIn ? !checkIn.check_out_time : false,
      current_check_in: checkIn,
      current_time_entry: currentTimeEntry,
      daily_stats: dailyStats,
    })

  } catch (error) {
    console.error('Get check-in status error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}