import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('Starting archive process for all stages')

    // Get all existing stages to archive
    const { data: existingStages, error: fetchError } = await supabase
      .from('job_stages')
      .select('id, name, description')

    if (fetchError) {
      console.error('Error fetching stages to archive:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch existing stages for archiving', 
        details: fetchError 
      }, { status: 500 })
    }

    if (!existingStages || existingStages.length === 0) {
      console.log('No stages found to archive')
      return NextResponse.json({ 
        success: true, 
        message: 'No stages found to archive' 
      })
    }

    console.log(`Found ${existingStages.length} stages to archive`)

    // Archive stages by renaming them instead of adding new columns
    // This preserves referential integrity without requiring schema changes
    const archiveTimestamp = Date.now()
    
    for (const stage of existingStages) {
      const { error: archiveError } = await supabase
        .from('job_stages')
        .update({ 
          name: `[ARCHIVED_${archiveTimestamp}] ${stage.name}`,  // Prefix with timestamp to avoid name conflicts
          description: `[ARCHIVED ${new Date().toISOString()}] ${stage.description || ''}` // Add archive info to description
        })
        .eq('id', stage.id)

      if (archiveError) {
        console.error(`Error archiving stage ${stage.name}:`, archiveError)
        return NextResponse.json({ 
          error: `Failed to archive stage: ${stage.name}`, 
          details: archiveError,
          step: 'archive',
          userMessage: `Unable to archive stage "${stage.name}". The archive process maintains data integrity while allowing new stages to be created.`
        }, { status: 500 })
      }
    }

    // Archive related transitions by disabling them instead of using new columns
    const { data: allTransitions } = await supabase
      .from('stage_transitions')
      .select('id')
      .limit(1000)

    if (allTransitions && allTransitions.length > 0) {
      // Simply disable transitions instead of archiving with new columns
      const { error: archiveTransitionsError } = await supabase
        .from('stage_transitions')
        .update({ 
          is_automatic: false,  // Disable automatic transitions
          conditions: { archived: true, timestamp: new Date().toISOString() } // Store archive info in existing JSON field
        })
        .in('id', allTransitions.map(t => t.id))

      // Don't fail if transitions archiving fails, just warn
      if (archiveTransitionsError) {
        console.warn('Warning archiving stage transitions:', archiveTransitionsError)
      } else {
        console.log(`Archived ${allTransitions.length} stage transitions`)
      }
    }

    console.log(`Successfully archived ${existingStages.length} stages and their dependencies`)
    return NextResponse.json({ 
      success: true, 
      message: `Successfully archived ${existingStages.length} existing stages`,
      archivedStages: existingStages.map(stage => stage.name)
    })
    
  } catch (error) {
    console.error('Error in archive-all stages API:', error)
    return NextResponse.json({ 
      error: 'Internal server error during stage archiving', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}