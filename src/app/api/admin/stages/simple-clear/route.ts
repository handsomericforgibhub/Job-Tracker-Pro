import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('Starting simple clear - just rename existing stages')

    // Get all existing stages
    const { data: existingStages, error: fetchError } = await supabase
      .from('job_stages')
      .select('id, name')

    if (fetchError) {
      console.error('Error fetching stages:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch existing stages', 
        details: fetchError 
      }, { status: 500 })
    }

    if (!existingStages || existingStages.length === 0) {
      console.log('No stages found to rename')
      return NextResponse.json({ 
        success: true, 
        message: 'No stages found to clear' 
      })
    }

    // Simply rename existing stages so new ones can be created without conflicts
    const timestamp = Date.now()
    console.log(`Renaming ${existingStages.length} existing stages to avoid conflicts`)
    
    for (const stage of existingStages) {
      const { error: renameError } = await supabase
        .from('job_stages')
        .update({ 
          name: `[OLD_${timestamp}] ${stage.name}`,
          sequence_order: 999 + Math.floor(Math.random() * 1000) // Move to high numbers to avoid conflicts
        })
        .eq('id', stage.id)

      if (renameError) {
        console.error(`Error renaming stage ${stage.name}:`, renameError)
        return NextResponse.json({ 
          error: `Failed to rename stage: ${stage.name}`, 
          details: renameError,
          step: 'rename',
          userMessage: `Unable to rename existing stage "${stage.name}" to make room for new stages.`
        }, { status: 500 })
      }
    }

    console.log(`Successfully renamed ${existingStages.length} existing stages`)
    return NextResponse.json({ 
      success: true, 
      message: `Successfully renamed ${existingStages.length} existing stages to make room for new preset`,
      renamedStages: existingStages.map(stage => stage.name)
    })
    
  } catch (error) {
    console.error('Error in simple-clear stages API:', error)
    return NextResponse.json({ 
      error: 'Internal server error during stage renaming', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}