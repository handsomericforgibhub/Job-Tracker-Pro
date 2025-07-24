/**
 * Automatic Stage Setup for New Companies
 * This module handles setting up the builder preset stages automatically
 * when a new company is created, eliminating the need for manual setup.
 */

import { createClient } from '@supabase/supabase-js'
import { STAGES_ARRAY } from '@/config/stages'

// Use service role key to bypass RLS for initial setup
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export interface StageSetupResult {
  success: boolean
  stagesCreated: number
  questionsCreated: number
  transitionsCreated: number
  error?: string
}

/**
 * Automatically sets up the builder preset stages for a new company
 * This runs server-side with admin privileges to bypass RLS issues
 */
export async function setupBuilderPresetForCompany(
  companyId: string, 
  createdByUserId: string
): Promise<StageSetupResult> {
  console.log('🏗️ Starting automatic stage setup for company:', companyId)
  
  try {
    // Define stage questions (same as in system-settings page)
    const stageQuestions = {
      1: [
        {
          question_text: "Have you qualified this lead as a viable opportunity?",
          response_type: 'yes_no',
          is_required: true,
          help_text: "Consider budget, timeline, and project scope",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: [
            { response_value: "yes", to_stage_order: 2, is_automatic: true, requires_admin_override: false }
          ]
        },
        {
          question_text: "What is the estimated project value?",
          response_type: 'number',
          is_required: false,
          help_text: "Enter rough estimate in dollars",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: []
        }
      ],
      2: [
        {
          question_text: "Have you scheduled a site meeting?",
          response_type: 'yes_no',
          is_required: true,
          help_text: "Schedule an on-site meeting to assess the project",
          mobile_optimized: true,
          sequence_order: 1,
          transitions: []
        },
        {
          question_text: "Have you conducted the meeting?",
          response_type: 'yes_no',
          is_required: true,
          help_text: "Complete the initial site assessment meeting",
          mobile_optimized: true,
          sequence_order: 2,
          transitions: [
            { response_value: "yes", to_stage_order: 3, is_automatic: true, requires_admin_override: false }
          ]
        }
      ],
      // Add more stage questions as needed - keeping it simple for now
    }

    // Track created items
    const stageIdMap: { [order: number]: string } = {}
    let stagesCreated = 0
    let questionsCreated = 0
    let transitionsCreated = 0

    console.log('📝 Creating stages for company...')
    
    // Create stages
    for (const stage of STAGES_ARRAY) {
      const stageData = {
        name: stage.name,
        description: stage.description,
        color: stage.color,
        sequence_order: stage.sequence_order,
        maps_to_status: stage.maps_to_status,
        stage_type: stage.stage_type,
        min_duration_hours: stage.min_duration_hours,
        max_duration_hours: stage.max_duration_hours,
        requires_approval: stage.stage_type === 'approval',
        company_id: companyId,
        created_by: createdByUserId
      }

      console.log(`  Creating stage: ${stage.name}`)
      
      const { data: newStage, error: stageError } = await supabaseAdmin
        .from('job_stages')
        .insert(stageData)
        .select()
        .single()

      if (stageError) {
        console.error('❌ Failed to create stage:', stage.name, stageError)
        throw new Error(`Failed to create stage ${stage.name}: ${stageError.message}`)
      }

      stageIdMap[stage.sequence_order] = newStage.id
      stagesCreated++
      console.log(`  ✅ Created stage: ${stage.name} (${newStage.id})`)
    }

    console.log('❓ Creating questions for stages...')
    
    // Create questions for stages that have them
    for (const [stageOrder, questions] of Object.entries(stageQuestions)) {
      const stageId = stageIdMap[parseInt(stageOrder)]
      if (!stageId) continue

      for (const questionData of questions) {
        console.log(`  Creating question: ${questionData.question_text}`)
        
        const { data: newQuestion, error: questionError } = await supabaseAdmin
          .from('stage_questions')
          .insert({
            stage_id: stageId,
            question_text: questionData.question_text,
            response_type: questionData.response_type,
            sequence_order: questionData.sequence_order,
            is_required: questionData.is_required,
            help_text: questionData.help_text,
            mobile_optimized: questionData.mobile_optimized,
            company_id: companyId
          })
          .select()
          .single()

        if (questionError) {
          console.error('❌ Failed to create question:', questionData.question_text, questionError)
          throw new Error(`Failed to create question: ${questionError.message}`)
        }

        questionsCreated++
        
        // Create transitions for this question
        for (const transitionData of questionData.transitions) {
          const toStageId = stageIdMap[transitionData.to_stage_order]
          if (!toStageId) continue

          console.log(`  Creating transition: ${questionData.question_text} -> Stage ${transitionData.to_stage_order}`)
          
          const { error: transitionError } = await supabaseAdmin
            .from('stage_transitions')
            .insert({
              from_stage_id: stageId,
              to_stage_id: toStageId,
              question_id: newQuestion.id,
              trigger_response: transitionData.response_value,
              is_automatic: transitionData.is_automatic,
              requires_admin_override: transitionData.requires_admin_override,
              conditions: { question_id: newQuestion.id }
            })

          if (transitionError) {
            console.error('❌ Failed to create transition:', transitionError)
            throw new Error(`Failed to create transition: ${transitionError.message}`)
          }

          transitionsCreated++
        }
      }
    }

    console.log('✅ Automatic stage setup completed:', {
      company: companyId,
      stages: stagesCreated,
      questions: questionsCreated,
      transitions: transitionsCreated
    })

    return {
      success: true,
      stagesCreated,
      questionsCreated,
      transitionsCreated
    }

  } catch (error) {
    console.error('❌ Automatic stage setup failed:', error)
    return {
      success: false,
      stagesCreated: 0,
      questionsCreated: 0,
      transitionsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}