import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// UUID validation helper
const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

// Create server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('Starting bulk deletion of all stages and dependencies')

    // Delete in specific order to handle foreign key constraints
    // This is a nuclear option that clears everything

    // 0. First check if we have any stages at all
    const { data: existingStages, error: checkError } = await supabase
      .from('job_stages')
      .select('id')
      .limit(1)

    if (checkError) {
      console.warn('Warning checking for existing stages:', checkError)
    }

    if (!existingStages || existingStages.length === 0) {
      console.log('No stages found, nothing to delete')
      return NextResponse.json({ 
        success: true, 
        message: 'No stages found to clear' 
      })
    }

    // 1. Delete all stage audit logs first (new table causing constraint issues)
    // First get all audit log IDs to avoid UUID comparison issues
    const { data: auditLogs, error: auditFetchError } = await supabase
      .from('stage_audit_log')
      .select('id')

    if (auditFetchError && !auditFetchError.message?.includes('does not exist')) {
      console.warn('Warning: Could not fetch audit logs for deletion:', auditFetchError)
    }

    // If we have audit logs, delete them one by one or in batches
    if (auditLogs && auditLogs.length > 0) {
      console.log(`Found ${auditLogs.length} audit log entries to delete`)
      
      // Delete in smaller batches to avoid overwhelming the database
      const batchSize = 100
      for (let i = 0; i < auditLogs.length; i += batchSize) {
        const batch = auditLogs.slice(i, i + batchSize)
        const batchIds = batch.map(log => log.id)
        
        const { error: auditBatchError } = await supabase
          .from('stage_audit_log')
          .delete()
          .in('id', batchIds)

        if (auditBatchError) {
          console.error(`Error deleting audit log batch ${i}-${i + batch.length}:`, auditBatchError)
          return NextResponse.json({ 
            error: 'Failed to delete stage audit logs - stages may be referenced in system logs', 
            details: auditBatchError,
            step: 'audit_logs',
            userMessage: 'Cannot delete stages that are still referenced in system audit logs. Please contact an administrator.'
          }, { status: 500 })
        }
      }
      console.log('Successfully deleted all audit log entries')
    } else {
      console.log('No audit log entries found to delete')
    }

    // 2. Delete all stage transitions  
    // Use a more reliable approach - check table structure and delete accordingly
    const { data: allTransitions, error: fetchTransitionsError } = await supabase
      .from('stage_transitions')
      .select('id')
      .limit(1000) // Limit to avoid overwhelming

    if (fetchTransitionsError && !fetchTransitionsError.message?.includes('does not exist')) {
      console.warn('Warning fetching transitions for deletion:', fetchTransitionsError)
    }

    if (allTransitions && allTransitions.length > 0) {
      const transitionIds = allTransitions.map(t => t.id)
      const { error: transitionsError } = await supabase
        .from('stage_transitions')
        .delete()
        .in('id', transitionIds)

      if (transitionsError) {
        console.error('Error deleting stage transitions:', transitionsError)
        return NextResponse.json({ 
          error: 'Failed to delete stage transitions', 
          details: transitionsError,
          step: 'transitions',
          userMessage: 'Unable to remove stage workflow connections. This may be due to data integrity issues.'
        }, { status: 500 })
      }
      console.log(`Deleted ${transitionIds.length} stage transitions`)
    } else {
      console.log('No stage transitions found to delete')
    }

    // 3. Delete all user responses (if any exist) - use safer approach
    const { data: allResponses } = await supabase.from('user_responses').select('id').limit(1000)
    if (allResponses && allResponses.length > 0) {
      const { error: responsesError } = await supabase
        .from('user_responses')
        .delete()
        .in('id', allResponses.map(r => r.id))
      if (responsesError && !responsesError.message?.includes('does not exist')) {
        console.warn('Warning deleting user responses:', responsesError)
      }
      console.log(`Deleted ${allResponses.length} user responses`)
    }

    // 4. Delete all stage questions - use safer approach  
    const { data: allQuestions } = await supabase.from('stage_questions').select('id').limit(1000)
    if (allQuestions && allQuestions.length > 0) {
      const { error: questionsError } = await supabase
        .from('stage_questions')
        .delete()
        .in('id', allQuestions.map(q => q.id))

      if (questionsError) {
        console.error('Error deleting all stage questions:', questionsError)
        return NextResponse.json({ 
          error: 'Failed to delete stage questions', 
          details: questionsError,
          step: 'questions',
          userMessage: 'Unable to remove stage questions. This may be due to existing user responses.'
        }, { status: 500 })
      }
      console.log(`Deleted ${allQuestions.length} stage questions`)
    }

    // 5. Delete all task templates (if table exists) - use safer approach
    const { data: allTemplates } = await supabase.from('task_templates').select('id').limit(1000)
    if (allTemplates && allTemplates.length > 0) {
      const { error: templatesError } = await supabase
        .from('task_templates')
        .delete()
        .in('id', allTemplates.map(t => t.id))
      if (templatesError && !templatesError.message?.includes('does not exist')) {
        console.warn('Warning deleting task templates:', templatesError)
      }
      console.log(`Deleted ${allTemplates.length} task templates`)
    }

    // 6. Delete all job tasks that might reference stages - use safer approach
    const { data: allJobTasks } = await supabase.from('job_tasks').select('id').limit(1000)
    if (allJobTasks && allJobTasks.length > 0) {
      const { error: jobTasksError } = await supabase
        .from('job_tasks')
        .delete()
        .in('id', allJobTasks.map(jt => jt.id))
      if (jobTasksError && !jobTasksError.message?.includes('does not exist')) {
        console.warn('Warning deleting job tasks:', jobTasksError)
      }
      console.log(`Deleted ${allJobTasks.length} job tasks`)
    }

    // 6.5. Delete all stage performance metrics that reference stages
    const { data: allMetrics } = await supabase.from('stage_performance_metrics').select('id').limit(1000)
    if (allMetrics && allMetrics.length > 0) {
      const { error: metricsError } = await supabase
        .from('stage_performance_metrics')
        .delete()
        .in('id', allMetrics.map(m => m.id))
      if (metricsError && !metricsError.message?.includes('does not exist')) {
        console.warn('Warning deleting stage performance metrics:', metricsError)
      }
      console.log(`Deleted ${allMetrics.length} stage performance metrics`)
    }

    // 6.6. Check for other common tables that might reference stages
    const potentialTables = [
      'stage_history',
      'stage_logs', 
      'stage_notifications',
      'stage_assignments',
      'stage_templates',
      'workflow_stages',
      'project_stages'
    ]

    for (const tableName of potentialTables) {
      try {
        const { data: tableData } = await supabase.from(tableName).select('id').limit(1)
        if (tableData) {
          // Table exists, try to clean it
          const { data: allRecords } = await supabase.from(tableName).select('id').limit(1000)
          if (allRecords && allRecords.length > 0) {
            const { error: cleanError } = await supabase
              .from(tableName)
              .delete()
              .in('id', allRecords.map(r => r.id))
            if (!cleanError) {
              console.log(`Cleaned ${allRecords.length} records from ${tableName}`)
            }
          }
        }
      } catch (error) {
        // Table doesn't exist or we don't have access - that's fine
      }
    }

    // 7. Update any jobs that reference stages
    const { error: jobsUpdateError } = await supabase
      .from('jobs')
      .update({ current_stage_id: null })
      .not('current_stage_id', 'is', null)

    if (jobsUpdateError) {
      console.warn('Warning updating jobs current_stage_id:', jobsUpdateError)
      // Don't fail for this, just warn
    }

    // 8. Finally delete all stages
    // First, let's check which stages might still have references
    const { data: remainingReferences, error: refCheckError } = await supabase
      .from('stage_audit_log')
      .select('stage_id, job_stages!inner(name)')
      .limit(10)

    if (remainingReferences && remainingReferences.length > 0) {
      const referencedStageNames = remainingReferences.map((ref: any) => ref.job_stages?.name).filter(Boolean)
      console.warn('Stages still referenced in audit logs:', referencedStageNames)
      
      return NextResponse.json({ 
        error: 'Cannot delete stages - still referenced in audit logs', 
        details: { 
          referencedStages: referencedStageNames,
          count: remainingReferences.length 
        },
        step: 'stages',
        userMessage: `The following stages cannot be deleted because they are still referenced in audit logs: ${referencedStageNames.join(', ')}. Please contact an administrator to clean up the audit logs first.`
      }, { status: 500 })
    }

    // Finally delete all stages using the safe approach  
    const { data: allStages } = await supabase.from('job_stages').select('id').limit(1000)
    let stagesError = null
    if (allStages && allStages.length > 0) {
      const deleteResult = await supabase
        .from('job_stages')
        .delete()
        .in('id', allStages.map(s => s.id))
      stagesError = deleteResult.error
      if (!stagesError) {
        console.log(`Deleted ${allStages.length} job stages`)
      }
    }

    if (stagesError) {
      console.error('Error deleting all job stages:', stagesError)
      
      // Check if it's a foreign key constraint error and extract table name
      if (stagesError.code === '23503') {
        const errorMessage = stagesError.message || ''
        const detailsMessage = stagesError.details || ''
        
        // Try to extract the referencing table name from the error
        let referencingTable = 'unknown table'
        const tableMatch = errorMessage.match(/table "([^"]+)"/) || detailsMessage.match(/from table "([^"]+)"/)
        if (tableMatch) {
          referencingTable = tableMatch[1]
        }
        
        return NextResponse.json({ 
          error: `Failed to delete job stages - still referenced in ${referencingTable}`, 
          details: stagesError,
          step: 'stages',
          userMessage: `Unable to delete stages. They are still referenced in the "${referencingTable}" table. This table was not included in our cleanup process. Please contact an administrator to resolve this dependency.`,
          referencingTable: referencingTable
        }, { status: 500 })
      }
      
      return NextResponse.json({ 
        error: 'Failed to delete job stages after cleaning dependencies', 
        details: stagesError,
        step: 'stages',
        userMessage: 'Unable to delete stages. They may still be referenced by active jobs or system logs.'
      }, { status: 500 })
    }

    console.log('Successfully cleared all stages and dependencies')
    return NextResponse.json({ 
      success: true, 
      message: 'All stages and dependencies cleared successfully' 
    })
    
  } catch (error) {
    console.error('Error in clear-all stages API:', error)
    return NextResponse.json({ 
      error: 'Internal server error during bulk deletion', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}