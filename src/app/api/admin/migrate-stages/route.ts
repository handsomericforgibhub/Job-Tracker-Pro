import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    console.log('🔄 Checking stage database status...')

    // Test if we can query job_stages table
    const { data: testQuery, error: testError } = await supabase
      .from('job_stages')
      .select('id')
      .limit(1)

    if (testError) {
      console.error('Database query error:', testError)
      
      // If it's a "column does not exist" error, we know the table exists but needs migration
      if (testError.code === '42703' && testError.message.includes('company_id')) {
        return NextResponse.json({ 
          error: 'Database schema needs migration',
          details: 'The job_stages table exists but is missing the company_id column',
          action: 'Run the 40-add-company-specific-stages.sql script in your Supabase SQL editor',
          sql_to_run: `
-- Add company_id column to job_stages
ALTER TABLE job_stages ADD COLUMN company_id UUID REFERENCES companies(id);
ALTER TABLE job_stages ADD COLUMN created_by UUID REFERENCES users(id);

-- Drop unique constraint and add company-specific one
ALTER TABLE job_stages DROP CONSTRAINT IF EXISTS unique_sequence_order;
ALTER TABLE job_stages ADD CONSTRAINT unique_company_sequence_order UNIQUE (company_id, sequence_order);

-- Create index
CREATE INDEX IF NOT EXISTS idx_job_stages_company_id ON job_stages(company_id);
          `.trim()
        }, { status: 422 })
      }
      
      // If table doesn't exist at all
      if (testError.code === '42P01') {
        return NextResponse.json({ 
          error: 'job_stages table does not exist',
          action: 'Run the 30-question-driven-progression-schema.sql script first in your Supabase SQL editor'
        }, { status: 404 })
      }

      // Other database errors
      return NextResponse.json({ 
        error: 'Database error',
        details: testError
      }, { status: 500 })
    }

    // If query succeeded, check if we have stages
    const { data: existingStages, error: stagesError } = await supabase
      .from('job_stages')
      .select('id, name, company_id')
      .filter('company_id', 'is', null)

    if (stagesError) {
      console.error('Error checking existing stages:', stagesError)
      return NextResponse.json({ 
        error: 'Failed to check existing stages',
        details: stagesError
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Database schema is properly configured',
      data: {
        schema_status: 'ready',
        existing_stages_count: existingStages?.length || 0,
        next_step: existingStages?.length === 0 ? 'Load initial stage data via POST /api/admin/load-stages' : 'Stages already loaded',
        stages: existingStages?.map(s => ({ id: s.id, name: s.name })) || []
      }
    })

  } catch (error) {
    console.error('❌ Error in stage migration check:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}