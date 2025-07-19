import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface RouteParams {
  params: {
    id: string
  }
}

// GET - Fetch single time entry
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    const { data: timeEntry, error } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching time entry:', error)
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    return NextResponse.json({ time_entry: timeEntry })

  } catch (error) {
    console.error('Get time entry error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// DELETE - Delete time entry
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if time entry exists and can be deleted
    const { data: existingEntry, error: fetchError } = await supabase
      .from('time_entries')
      .select('status, approved_by')
      .eq('id', id)
      .single()

    if (fetchError || !existingEntry) {
      return NextResponse.json({ error: 'Time entry not found' }, { status: 404 })
    }

    // Check if entry can be deleted (not approved)
    if (existingEntry.status === 'approved') {
      return NextResponse.json({ 
        error: 'Cannot delete approved time entry' 
      }, { status: 400 })
    }

    // Delete associated break entries first
    const { error: breakDeleteError } = await supabase
      .from('break_entries')
      .delete()
      .eq('time_entry_id', id)

    if (breakDeleteError) {
      console.error('Error deleting break entries:', breakDeleteError)
      return NextResponse.json({ 
        error: 'Failed to delete associated break entries' 
      }, { status: 500 })
    }

    // Delete the time entry
    const { error: deleteError } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting time entry:', deleteError)
      return NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Time entry deleted successfully'
    })

  } catch (error) {
    console.error('Delete time entry error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}