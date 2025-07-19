import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('Starting smart clear - attempt deletion with progressive fallback')

    // Get all existing stages first
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
      console.log('No stages found to clear')
      return NextResponse.json({ 
        success: true, 
        message: 'No stages found to clear' 
      })
    }

    console.log(`Found ${existingStages.length} stages to clear`)

    // Known tables that commonly reference stages - in order of dependency
    const knownReferencingTables = [
      'stage_audit_log',
      'stage_transitions', 
      'user_responses',
      'stage_questions',
      'stage_performance_metrics',
      'task_templates',
      'job_tasks',
      'stage_history',
      'stage_logs',
      'stage_notifications',
      'stage_assignments',
      'workflow_stages'
    ]

    // Try to clean each known table
    for (const tableName of knownReferencingTables) {
      try {
        const { data: records } = await supabase.from(tableName).select('id').limit(1)
        if (records !== null) { // Table exists and is accessible
          const { data: allRecords } = await supabase.from(tableName).select('id').limit(2000)
          if (allRecords && allRecords.length > 0) {
            // Try to delete in batches
            const batchSize = 500
            for (let i = 0; i < allRecords.length; i += batchSize) {
              const batch = allRecords.slice(i, i + batchSize)
              const { error: deleteError } = await supabase
                .from(tableName)
                .delete()
                .in('id', batch.map(r => r.id))
              
              if (deleteError) {
                console.warn(`Warning cleaning ${tableName} batch ${i}-${i + batch.length}:`, deleteError)
                break // Skip to next table if batch fails
              }
            }
            console.log(`Cleaned ${allRecords.length} records from ${tableName}`)
          }
        }
      } catch (error) {
        // Table doesn't exist or we don't have access - continue
        console.log(`Skipping ${tableName} (not accessible)`)
      }
    }

    // Update jobs to remove stage references
    const { error: jobsUpdateError } = await supabase
      .from('jobs')
      .update({ current_stage_id: null })
      .not('current_stage_id', 'is', null)

    if (jobsUpdateError) {
      console.warn('Warning updating jobs current_stage_id:', jobsUpdateError)
    }

    // Now try to delete stages
    const stageIds = existingStages.map(s => s.id)
    const { error: stagesError } = await supabase
      .from('job_stages')
      .delete()
      .in('id', stageIds)

    if (stagesError) {
      console.error('Error deleting stages after cleanup:', stagesError)
      
      // If still getting foreign key errors, extract the table name for better error message
      if (stagesError.code === '23503') {
        const errorMessage = stagesError.message || ''
        const detailsMessage = stagesError.details || ''
        
        let referencingTable = 'unknown table'
        const tableMatch = errorMessage.match(/table "([^"]+)"/) || detailsMessage.match(/from table "([^"]+)"/)
        if (tableMatch) {
          referencingTable = tableMatch[1]
        }
        
        return NextResponse.json({ 
          error: `Stages still referenced in ${referencingTable}`, 
          details: stagesError,
          step: 'final_deletion',
          userMessage: `Unable to delete stages. After cleaning all known dependencies, they are still referenced in the "${referencingTable}" table. Consider using the archive approach instead.`,
          referencingTable: referencingTable,
          suggestion: 'Try using the archive approach which preserves all references while allowing new stages to be created.'
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to delete stages after extensive cleanup', 
        details: stagesError,
        step: 'final_deletion',
        userMessage: 'Unable to delete stages even after cleaning dependencies. Consider using the archive approach instead.'
      }, { status: 500 })
    }

    console.log(`Successfully deleted ${existingStages.length} stages after cleaning dependencies`)
    return NextResponse.json({ 
      success: true, 
      message: `Successfully deleted ${existingStages.length} stages after cleaning all dependencies`,
      deletedStages: existingStages.map(stage => stage.name),
      cleanedTables: knownReferencingTables
    })
    
  } catch (error) {
    console.error('Error in smart-clear stages API:', error)
    return NextResponse.json({ 
      error: 'Internal server error during smart stage clearing', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}