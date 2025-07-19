import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Fetch workers with filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const company_id = searchParams.get('company_id')
    const user_id = searchParams.get('user_id')
    const employment_status = searchParams.get('employment_status')
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('workers')
      .select(`
        *,
        users!inner(
          id,
          full_name,
          email,
          role
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (company_id) query = query.eq('company_id', company_id)
    if (user_id) query = query.eq('user_id', user_id)
    if (employment_status) query = query.eq('employment_status', employment_status)

    const { data: workers, error } = await query

    if (error) {
      console.error('Error fetching workers:', error)
      return NextResponse.json({ error: 'Failed to fetch workers' }, { status: 500 })
    }

    return NextResponse.json({
      workers: workers || []
    })

  } catch (error) {
    console.error('Get workers error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}

// POST - Create new worker
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Get user from session (implement proper auth check)
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: worker, error: insertError } = await supabase
      .from('workers')
      .insert(body)
      .select('*')
      .single()

    if (insertError) {
      console.error('Error creating worker:', insertError)
      return NextResponse.json({ error: 'Failed to create worker' }, { status: 500 })
    }

    return NextResponse.json({
      worker,
      message: 'Worker created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create worker error:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}