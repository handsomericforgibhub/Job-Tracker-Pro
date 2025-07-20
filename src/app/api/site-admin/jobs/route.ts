import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const companyId = searchParams.get('company_id')

    // Build the query
    let query = supabase
      .from('jobs')
      .select(`
        *,
        company:companies!jobs_company_id_fkey (
          id,
          name
        ),
        current_stage:job_stages!current_stage_id (
          id,
          name,
          color,
          sequence_order
        )
      `)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (companyId && companyId !== 'all') {
      query = query.eq('company_id', companyId)
    }

    const { data: jobs, error } = await query

    if (error) {
      console.error('Error fetching jobs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: error.message },
        { status: 500 }
      )
    }

    // Get worker counts for each job
    const jobsWithWorkerCounts = await Promise.all(
      (jobs || []).map(async (job) => {
        const { count } = await supabase
          .from('user_jobs')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)

        return {
          ...job,
          worker_count: count || 0
        }
      })
    )

    return NextResponse.json({ 
      jobs: jobsWithWorkerCounts,
      total: jobsWithWorkerCounts.length 
    })

  } catch (error) {
    console.error('Site admin jobs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}