const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://iyfrjrudqjftkjvegevi.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZHVwcGl1c21zb21lc3FiZmVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1Mjc0OTM4MywiZXhwIjoyMDY4MzI1MzgzfQ.N1PgV58mHNCXgcyW1__s6bN-1RljPE-PhUm08U-4dkI'
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
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
    company_id: null
  }
]

const questions = [
  // Lead Qualification Questions
  {
    id: '650e8400-e29b-41d4-a716-446655440001',
    stage_id: '550e8400-e29b-41d4-a716-446655440001',
    question_text: 'Have you qualified this lead as a viable opportunity?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Consider budget, timeline, and project scope',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440002',
    stage_id: '550e8400-e29b-41d4-a716-446655440001',
    question_text: 'What is the estimated project value?',
    response_type: 'number',
    sequence_order: 2,
    help_text: 'Enter rough estimate in dollars',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440003',
    stage_id: '550e8400-e29b-41d4-a716-446655440001',
    question_text: 'When does the client want to start?',
    response_type: 'date',
    sequence_order: 3,
    help_text: 'Ideal project start date',
    skip_conditions: {}
  },

  // Initial Client Meeting Questions
  {
    id: '650e8400-e29b-41d4-a716-446655440004',
    stage_id: '550e8400-e29b-41d4-a716-446655440002',
    question_text: 'Have you had your initial meeting with the client?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Face-to-face or video meeting to discuss project',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440005',
    stage_id: '550e8400-e29b-41d4-a716-446655440002',
    question_text: 'When is the site meeting scheduled?',
    response_type: 'date',
    sequence_order: 2,
    help_text: 'Schedule on-site assessment',
    skip_conditions: { "previous_responses": [{ "question_id": "650e8400-e29b-41d4-a716-446655440004", "response_value": "Yes" }] }
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440006',
    stage_id: '550e8400-e29b-41d4-a716-446655440002',
    question_text: 'Upload meeting notes or photos',
    response_type: 'file_upload',
    sequence_order: 3,
    help_text: 'Document important details from the meeting',
    skip_conditions: {}
  },

  // Quote Preparation Questions
  {
    id: '650e8400-e29b-41d4-a716-446655440007',
    stage_id: '550e8400-e29b-41d4-a716-446655440003',
    question_text: 'Have you completed the site assessment?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Detailed on-site evaluation for accurate quoting',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440008',
    stage_id: '550e8400-e29b-41d4-a716-446655440003',
    question_text: 'Are all materials and labor costs calculated?',
    response_type: 'yes_no',
    sequence_order: 2,
    help_text: 'Ensure comprehensive cost breakdown',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440009',
    stage_id: '550e8400-e29b-41d4-a716-446655440003',
    question_text: 'What is the total quote amount?',
    response_type: 'number',
    sequence_order: 3,
    help_text: 'Final quote amount including all costs and margin',
    skip_conditions: {}
  }
  // Add more questions as needed...
]

const transitions = [
  // From Lead Qualification
  {
    from_stage_id: '550e8400-e29b-41d4-a716-446655440001',
    to_stage_id: '550e8400-e29b-41d4-a716-446655440002',
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440001" },
    is_automatic: true
  },
  {
    from_stage_id: '550e8400-e29b-41d4-a716-446655440001',
    to_stage_id: '550e8400-e29b-41d4-a716-446655440012',
    trigger_response: 'No',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440001", "action": "close_as_unqualified" },
    is_automatic: false
  },

  // From Initial Client Meeting
  {
    from_stage_id: '550e8400-e29b-41d4-a716-446655440002',
    to_stage_id: '550e8400-e29b-41d4-a716-446655440003',
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440004" },
    is_automatic: true
  },

  // From Quote Preparation
  {
    from_stage_id: '550e8400-e29b-41d4-a716-446655440003',
    to_stage_id: '550e8400-e29b-41d4-a716-446655440004',
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440008" },
    is_automatic: true
  }
  // Add more transitions as needed...
]

async function loadStagesData() {
  console.log('🔄 Loading stages data...')

  try {
    // First, clear existing global stages
    console.log('Clearing existing global stages...')
    const { error: clearError } = await supabase
      .from('job_stages')
      .delete()
      .filter('company_id', 'is', null)

    if (clearError) {
      console.error('Error clearing stages:', clearError)
    }

    // Insert stages
    console.log('Inserting stages...')
    const { data: stagesData, error: stagesError } = await supabase
      .from('job_stages')
      .insert(stages)
      .select()

    if (stagesError) {
      console.error('Error inserting stages:', stagesError)
      return
    }

    console.log(`✅ Inserted ${stagesData.length} stages`)

    // Insert questions
    console.log('Inserting stage questions...')
    const { data: questionsData, error: questionsError } = await supabase
      .from('stage_questions')
      .insert(questions)
      .select()

    if (questionsError) {
      console.error('Error inserting questions:', questionsError)
    } else {
      console.log(`✅ Inserted ${questionsData.length} questions`)
    }

    // Insert transitions
    console.log('Inserting stage transitions...')
    const { data: transitionsData, error: transitionsError } = await supabase
      .from('stage_transitions')
      .insert(transitions)
      .select()

    if (transitionsError) {
      console.error('Error inserting transitions:', transitionsError)
    } else {
      console.log(`✅ Inserted ${transitionsData.length} transitions`)
    }

    console.log('🎉 Stage data loading complete!')

  } catch (error) {
    console.error('❌ Error loading stage data:', error)
  }
}

// Run the script
loadStagesData().then(() => {
  console.log('Script completed')
  process.exit(0)
}).catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})