import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const stageIds = [
  '550e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440002',
  '550e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440004',
  '550e8400-e29b-41d4-a716-446655440005',
  '550e8400-e29b-41d4-a716-446655440006',
  '550e8400-e29b-41d4-a716-446655440007',
  '550e8400-e29b-41d4-a716-446655440008',
  '550e8400-e29b-41d4-a716-446655440009',
  '550e8400-e29b-41d4-a716-446655440010',
  '550e8400-e29b-41d4-a716-446655440011',
  '550e8400-e29b-41d4-a716-446655440012'
]

export async function GET() {
  try {
    console.log('🔍 Checking existing stages...')

    // Check what stages currently exist
    const { data: existingStages, error: queryError } = await supabase
      .from('job_stages')
      .select('id, name, company_id, sequence_order')
      .order('sequence_order')

    if (queryError) {
      return NextResponse.json({ 
        error: 'Failed to query existing stages',
        details: queryError
      }, { status: 500 })
    }

    // Check specifically for our target stage IDs
    const conflictingStages = existingStages?.filter(stage => 
      stageIds.includes(stage.id)
    ) || []

    return NextResponse.json({ 
      success: true,
      message: 'Stage analysis complete',
      data: {
        total_stages: existingStages?.length || 0,
        conflicting_stages: conflictingStages.length,
        global_stages: existingStages?.filter(s => s.company_id === null).length || 0,
        company_stages: existingStages?.filter(s => s.company_id !== null).length || 0,
        all_stages: existingStages,
        conflicts: conflictingStages
      }
    })

  } catch (error) {
    console.error('❌ Error checking stages:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    console.log('🧹 Cleaning up existing stages...')

    // Method 1: Delete by specific IDs
    const { error: deleteByIdError } = await supabase
      .from('job_stages')
      .delete()
      .in('id', stageIds)

    if (deleteByIdError) {
      console.error('Delete by ID failed:', deleteByIdError)
    } else {
      console.log('✅ Deleted stages by ID')
    }

    // Method 2: Delete all global stages (company_id = null)
    const { error: deleteGlobalError } = await supabase
      .from('job_stages')
      .delete()
      .filter('company_id', 'is', null)

    if (deleteGlobalError) {
      console.error('Delete global stages failed:', deleteGlobalError)
    } else {
      console.log('✅ Deleted global stages')
    }

    // Check what's left
    const { data: remainingStages, error: queryError } = await supabase
      .from('job_stages')
      .select('id, name, company_id')

    return NextResponse.json({ 
      success: true,
      message: 'Cleanup completed',
      data: {
        remaining_stages: remainingStages?.length || 0,
        stages: remainingStages || [],
        delete_by_id_error: deleteByIdError,
        delete_global_error: deleteGlobalError
      }
    })

  } catch (error) {
    console.error('❌ Error in cleanup:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    console.log('🔄 Resetting stages (clean + reload)...')

    // Step 1: Clean up
    const deleteResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/reset-stages`, {
      method: 'DELETE',
    })

    if (!deleteResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to clean up existing stages',
        details: await deleteResponse.text()
      }, { status: 500 })
    }

    // Step 2: Load fresh stages
    const loadResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/admin/load-stages-simple`, {
      method: 'POST',
    })

    const loadResult = await loadResponse.json()

    return NextResponse.json({ 
      success: loadResponse.ok,
      message: loadResponse.ok ? 'Stages reset and reloaded successfully' : 'Reset completed but reload failed',
      cleanup: 'completed',
      reload: loadResult
    })

  } catch (error) {
    console.error('❌ Error in reset:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}