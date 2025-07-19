import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  try {
    console.log('🔄 Testing database connection and schema...')

    // Test 1: Basic connection
    const { data: testConnection, error: connectionError } = await supabase
      .from('job_stages')
      .select('count')
      .limit(1)

    if (connectionError) {
      return NextResponse.json({ 
        error: 'Database connection failed',
        details: connectionError,
        test: 'connection'
      }, { status: 500 })
    }

    // Test 2: Check schema
    const { data: columns, error: schemaError } = await supabase
      .rpc('get_table_columns', { table_name: 'job_stages' })
      .then(() => ({ data: 'function_exists', error: null }))
      .catch(() => ({ data: null, error: 'function_not_available' }))

    // Test 3: Try inserting a simple stage
    const testStage = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Test Stage',
      description: 'Test description',
      color: '#FF0000',
      sequence_order: 999,
      maps_to_status: 'planning',
      stage_type: 'standard',
      min_duration_hours: 1,
      max_duration_hours: 24,
      company_id: null,
      created_by: null
    }

    // First clear any existing test stage
    await supabase
      .from('job_stages')
      .delete()
      .eq('id', testStage.id)

    const { data: insertResult, error: insertError } = await supabase
      .from('job_stages')
      .insert([testStage])
      .select()

    if (insertError) {
      return NextResponse.json({ 
        error: 'Insert test failed',
        details: insertError,
        test: 'insert'
      }, { status: 500 })
    }

    // Clean up test stage
    await supabase
      .from('job_stages')
      .delete()
      .eq('id', testStage.id)

    // Test 4: Check existing stages
    const { data: existingStages, error: stagesError } = await supabase
      .from('job_stages')
      .select('id, name, sequence_order, company_id')
      .order('sequence_order')

    if (stagesError) {
      return NextResponse.json({ 
        error: 'Query existing stages failed',
        details: stagesError,
        test: 'query'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Database tests passed',
      tests: {
        connection: 'passed',
        schema: schemaError || 'passed',
        insert: 'passed',
        query: 'passed'
      },
      existing_stages: existingStages?.length || 0,
      stages: existingStages
    })

  } catch (error) {
    console.error('❌ Error in database test:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error',
      test: 'general'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    console.log('🔄 Testing single stage insert...')

    const singleStage = {
      name: '1/12 Lead Qualification',
      description: 'Initial assessment of lead viability and requirements',
      color: '#C7D2FE',
      sequence_order: 1,
      maps_to_status: 'planning',
      stage_type: 'standard',
      min_duration_hours: 1,
      max_duration_hours: 168,
      company_id: null,
      created_by: null
    }

    // Clear any existing stage with same sequence_order
    await supabase
      .from('job_stages')
      .delete()
      .eq('sequence_order', 1)
      .filter('company_id', 'is', null)

    const { data: result, error: insertError } = await supabase
      .from('job_stages')
      .insert([singleStage])
      .select()

    if (insertError) {
      return NextResponse.json({ 
        error: 'Single stage insert failed',
        details: insertError,
        stage: singleStage
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Single stage insert successful',
      data: result
    })

  } catch (error) {
    console.error('❌ Error in single stage test:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}