import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`
        *,
        users:users!users_company_id_fkey (
          id
        ),
        jobs:jobs!jobs_company_id_fkey (
          id,
          status
        )
      `)
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching companies:', error)
      return NextResponse.json(
        { error: 'Failed to fetch companies', details: error.message },
        { status: 500 }
      )
    }

    // Calculate stats for each company
    const companiesWithStats = (companies || []).map(company => ({
      id: company.id,
      name: company.name,
      created_at: company.created_at,
      user_count: company.users?.length || 0,
      job_count: company.jobs?.length || 0,
      active_jobs: company.jobs?.filter((job: any) => job.status === 'active').length || 0
    }))

    return NextResponse.json({ 
      companies: companiesWithStats,
      total: companiesWithStats.length 
    })

  } catch (error) {
    console.error('Site admin companies API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}