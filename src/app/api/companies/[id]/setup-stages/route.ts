import { NextRequest, NextResponse } from 'next/server'
import { setupBuilderPresetForCompany } from '@/lib/auto-setup-stages'

/**
 * Automatically sets up builder preset stages for a newly created company
 * This endpoint is called internally after company creation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🏗️ Auto-setup stages request for company:', params.id)
    
    const body = await request.json()
    const { created_by_user_id } = body
    
    if (!created_by_user_id) {
      return NextResponse.json({ 
        error: 'created_by_user_id is required' 
      }, { status: 400 })
    }

    console.log('👤 Setting up stages for user:', created_by_user_id)
    
    const result = await setupBuilderPresetForCompany(params.id, created_by_user_id)
    
    if (!result.success) {
      console.error('❌ Stage setup failed:', result.error)
      return NextResponse.json({ 
        error: 'Failed to setup stages',
        details: result.error 
      }, { status: 500 })
    }

    console.log('✅ Stage setup completed successfully:', result)
    
    return NextResponse.json({
      success: true,
      message: 'Builder preset stages created successfully',
      ...result
    })

  } catch (error) {
    console.error('❌ Error in auto-setup stages endpoint:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}