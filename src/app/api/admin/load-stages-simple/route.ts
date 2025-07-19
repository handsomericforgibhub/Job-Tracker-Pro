import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stages = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
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
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: '2/12 Initial Client Meeting',
    description: 'First meeting with client to understand project scope',
    color: '#A5B4FC',
    sequence_order: 2,
    maps_to_status: 'planning',
    stage_type: 'milestone',
    min_duration_hours: 2,
    max_duration_hours: 72,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: '3/12 Quote Preparation',
    description: 'Prepare detailed project quote and estimates',
    color: '#93C5FD',
    sequence_order: 3,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 4,
    max_duration_hours: 120,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440004',
    name: '4/12 Quote Submission',
    description: 'Submit quote to client and await response',
    color: '#60A5FA',
    sequence_order: 4,
    maps_to_status: 'planning',
    stage_type: 'milestone',
    min_duration_hours: 1,
    max_duration_hours: 336,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440005',
    name: '5/12 Client Decision',
    description: 'Client reviews and makes decision on quote',
    color: '#38BDF8',
    sequence_order: 5,
    maps_to_status: 'planning',
    stage_type: 'approval',
    min_duration_hours: 1,
    max_duration_hours: 168,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440006',
    name: '6/12 Contract & Deposit',
    description: 'Finalize contract terms and collect deposit',
    color: '#34D399',
    sequence_order: 6,
    maps_to_status: 'active',
    stage_type: 'milestone',
    min_duration_hours: 2,
    max_duration_hours: 72,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440007',
    name: '7/12 Planning & Procurement',
    description: 'Detailed planning and material procurement',
    color: '#4ADE80',
    sequence_order: 7,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 8,
    max_duration_hours: 168,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440008',
    name: '8/12 On-Site Preparation',
    description: 'Site preparation and setup for construction',
    color: '#FACC15',
    sequence_order: 8,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 4,
    max_duration_hours: 72,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440009',
    name: '9/12 Construction Execution',
    description: 'Main construction and building phase',
    color: '#FB923C',
    sequence_order: 9,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 40,
    max_duration_hours: 2000,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440010',
    name: '10/12 Inspections & Progress Payments',
    description: 'Quality inspections and progress billing',
    color: '#F87171',
    sequence_order: 10,
    maps_to_status: 'active',
    stage_type: 'milestone',
    min_duration_hours: 2,
    max_duration_hours: 48,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440011',
    name: '11/12 Finalisation',
    description: 'Final touches and completion preparations',
    color: '#F472B6',
    sequence_order: 11,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 8,
    max_duration_hours: 120,
    company_id: null,
    created_by: null
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    name: '12/12 Handover & Close',
    description: 'Final handover and project closure',
    color: '#D1D5DB',
    sequence_order: 12,
    maps_to_status: 'completed',
    stage_type: 'milestone',
    min_duration_hours: 1,
    max_duration_hours: 24,
    company_id: null,
    created_by: null
  }
]

export async function POST() {
  try {
    console.log('🔄 Loading stages data (simple version)...')

    // First, clear existing global stages safely
    console.log('Clearing existing global stages...')
    const { error: clearError } = await supabase
      .from('job_stages')
      .delete()
      .filter('company_id', 'is', null)

    if (clearError) {
      console.log('Clear error (might be okay):', clearError)
    }

    // Insert stages one by one to better handle errors
    const results = []
    const errors = []

    for (const stage of stages) {
      try {
        const { data: stageData, error: stageError } = await supabase
          .from('job_stages')
          .insert([stage])
          .select()

        if (stageError) {
          console.error(`Error inserting stage ${stage.name}:`, stageError)
          errors.push({ stage: stage.name, error: stageError })
        } else {
          console.log(`✅ Inserted stage: ${stage.name}`)
          results.push(stageData[0])
        }
      } catch (e) {
        console.error(`Exception inserting stage ${stage.name}:`, e)
        errors.push({ stage: stage.name, error: e instanceof Error ? e.message : 'Unknown error' })
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        error: 'Some stages failed to insert',
        successful: results.length,
        failed: errors.length,
        errors: errors,
        data: results
      }, { status: 207 }) // 207 Multi-Status
    }

    return NextResponse.json({ 
      success: true,
      message: 'All stages loaded successfully',
      data: {
        stages: results.length,
        inserted: results
      }
    })

  } catch (error) {
    console.error('❌ Error in simple stage loading:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}