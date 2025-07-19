import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { z } from 'zod'

const checkOutSchema = z.object({
  worker_id: z.string().uuid(),
  check_in_id: z.string().uuid().optional(),
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
      check_in_id, 
      location, 
      gps_lat, 
      gps_lng, 
      gps_accuracy, 
      gps_speed, 
      gps_heading, 
      location_verified, 
      verification_distance, 
      notes 
    } = checkOutSchema.parse(body)

    // Get user from session (you may need to implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find active check-in
    let activeCheckIn
    if (check_in_id) {
      const { data, error } = await supabase
        .from('worker_check_ins')
        .select('*')
        .eq('id', check_in_id)
        .eq('worker_id', worker_id)
        .is('check_out_time', null)
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Active check-in not found' }, { status: 404 })
      }
      activeCheckIn = data
    } else {
      // Find most recent active check-in for worker
      const { data, error } = await supabase
        .from('worker_check_ins')
        .select('*')
        .eq('worker_id', worker_id)
        .is('check_out_time', null)
        .order('check_in_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error finding active check-in:', error)
        return NextResponse.json({ error: 'Failed to find active check-in' }, { status: 500 })
      }

      if (!data) {
        return NextResponse.json({ error: 'No active check-in found' }, { status: 400 })
      }
      activeCheckIn = data
    }

    const checkOutTime = new Date().toISOString()
    const checkInTime = new Date(activeCheckIn.check_in_time)
    const totalMinutes = Math.floor((new Date(checkOutTime).getTime() - checkInTime.getTime()) / (1000 * 60))

    // Update check-in record with check-out time
    const { data: updatedCheckIn, error: updateError } = await supabase
      .from('worker_check_ins')
      .update({
        check_out_time: checkOutTime,
        notes: notes || activeCheckIn.notes,
        gps_accuracy: gps_accuracy || activeCheckIn.gps_accuracy,
      })
      .eq('id', activeCheckIn.id)
      .select(`
        *,
        worker:workers(id, first_name, last_name, hourly_rate),
        job:jobs(id, title, location)
      `)
      .single()

    if (updateError) {
      console.error('Error updating check-in:', updateError)
      return NextResponse.json({ error: 'Failed to update check-in' }, { status: 500 })
    }

    // Find and update active time entry
    const { data: activeTimeEntry, error: timeEntryFindError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('check_in_id', activeCheckIn.id)
      .is('end_time', null)
      .maybeSingle()

    if (timeEntryFindError) {
      console.error('Error finding active time entry:', timeEntryFindError)
      return NextResponse.json({ error: 'Failed to find active time entry' }, { status: 500 })
    }

    let updatedTimeEntry = null
    if (activeTimeEntry) {
      // Calculate break time from break entries
      const { data: breakEntries } = await supabase
        .from('break_entries')
        .select('duration_minutes')
        .eq('time_entry_id', activeTimeEntry.id)
        .not('duration_minutes', 'is', null)

      const totalBreakMinutes = breakEntries?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0

      // Determine if this is overtime
      const { data: todayEntries } = await supabase
        .from('time_entries')
        .select('duration_minutes')
        .eq('worker_id', worker_id)
        .gte('start_time', new Date().toISOString().split('T')[0] + 'T00:00:00Z')
        .not('duration_minutes', 'is', null)

      const todayTotalMinutes = todayEntries?.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) || 0
      const projectedTotalMinutes = todayTotalMinutes + totalMinutes
      const isOvertime = projectedTotalMinutes > (8 * 60) // More than 8 hours

      // Get worker hourly rate for cost calculation
      const { data: worker } = await supabase
        .from('workers')
        .select('hourly_rate')
        .eq('id', worker_id)
        .single()

      const hourlyRate = worker?.hourly_rate || 0
      const overtimeRate = isOvertime ? hourlyRate * 1.5 : hourlyRate

      const { data: timeEntry, error: timeEntryUpdateError } = await supabase
        .from('time_entries')
        .update({
          end_time: checkOutTime,
          duration_minutes: totalMinutes,
          break_duration_minutes: totalBreakMinutes,
          end_location: location || null,
          end_gps_lat: gps_lat || null,
          end_gps_lng: gps_lng || null,
          end_gps_speed: gps_speed || null,
          end_gps_heading: gps_heading || null,
          end_location_verified: location_verified || false,
          end_verification_distance: verification_distance || null,
          entry_type: isOvertime ? 'overtime' : 'regular',
          hourly_rate: hourlyRate,
          overtime_rate: isOvertime ? overtimeRate : null,
          total_cost: ((totalMinutes - totalBreakMinutes) / 60) * (isOvertime ? overtimeRate : hourlyRate),
        })
        .eq('id', activeTimeEntry.id)
        .select(`
          *,
          worker:workers(id, first_name, last_name),
          job:jobs(id, title),
          break_entries(*)
        `)
        .single()

      if (timeEntryUpdateError) {
        console.error('Error updating time entry:', timeEntryUpdateError)
        return NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 })
      }

      updatedTimeEntry = timeEntry
    }

    // Calculate daily summary
    const today = new Date().toISOString().split('T')[0]
    const { data: dailyEntries } = await supabase
      .from('time_entries')
      .select('duration_minutes, entry_type, break_duration_minutes, total_cost')
      .eq('worker_id', worker_id)
      .gte('start_time', `${today}T00:00:00Z`)
      .not('duration_minutes', 'is', null)

    const dailySummary = dailyEntries?.reduce((acc, entry) => {
      const hours = (entry.duration_minutes || 0) / 60
      const breakHours = (entry.break_duration_minutes || 0) / 60
      const cost = entry.total_cost || 0
      
      if (entry.entry_type === 'overtime') {
        acc.overtime_hours += hours
        acc.overtime_cost += cost
      } else {
        acc.regular_hours += hours
        acc.regular_cost += cost
      }
      acc.break_hours += breakHours
      acc.total_cost += cost
      return acc
    }, { 
      regular_hours: 0, 
      overtime_hours: 0, 
      break_hours: 0, 
      regular_cost: 0, 
      overtime_cost: 0, 
      total_cost: 0 
    }) || { 
      regular_hours: 0, 
      overtime_hours: 0, 
      break_hours: 0, 
      regular_cost: 0, 
      overtime_cost: 0, 
      total_cost: 0 
    }

    return NextResponse.json({
      check_in: updatedCheckIn,
      time_entry: updatedTimeEntry,
      daily_summary: dailySummary,
      total_minutes: totalMinutes,
      message: 'Successfully checked out'
    })

  } catch (error) {
    console.error('Check-out error:', error)
    
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