import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const transitionId = params.id
    const updates = await request.json()

    const { data: transition, error } = await supabase
      .from('stage_transitions')
      .update(updates)
      .eq('id', transitionId)
      .select()
      .single()

    if (error) {
      console.error('Error updating transition:', error)
      return NextResponse.json({ error: 'Failed to update transition', details: error }, { status: 500 })
    }

    return NextResponse.json({ data: transition })
  } catch (error) {
    console.error('Error in transition PUT API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params
    const transitionId = params.id

    const { error } = await supabase
      .from('stage_transitions')
      .delete()
      .eq('id', transitionId)

    if (error) {
      console.error('Error deleting transition:', error)
      return NextResponse.json({ error: 'Failed to delete transition', details: error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in transition DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}