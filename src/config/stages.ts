export interface StageDefinition {
  id: string
  name: string
  description: string
  color: string
  sequence_order: number
  maps_to_status: 'planning' | 'active' | 'completed'
  stage_type: 'standard' | 'milestone' | 'approval'
  min_duration_hours: number
  max_duration_hours: number
  company_id: null | string
}

export interface StageQuestion {
  id: string
  stage_id: string
  question_text: string
  response_type: 'yes_no' | 'text' | 'number' | 'date' | 'file_upload' | 'multiple_choice'
  sequence_order: number
  help_text: string
  skip_conditions: Record<string, any>
}

export interface StageTransition {
  from_stage_id: string
  to_stage_id: string
  trigger_response: string
  conditions: Record<string, any>
  is_automatic: boolean
}

export const STAGE_IDS = {
  LEAD_QUALIFICATION: 'a78e020b-562d-42b6-be2c-ce006670f230',
  INITIAL_CLIENT_MEETING: '4bdc428d-5849-438c-b731-b1815d8fb1ab',
  QUOTE_PREPARATION: 'a622d108-1714-4bb9-925c-4eaab2b7746b',
  QUOTE_SUBMISSION: '12f412c5-cd23-4a38-8494-3f0b7a181457',
  CLIENT_DECISION: '62d954ec-6431-49c6-ac55-37c20a6c5a0f',
  CONTRACT_DEPOSIT: '0c1cab00-fe65-4ef8-b988-58c44e4151ca',
  PLANNING_PROCUREMENT: 'a61b3d2b-d567-44be-b0b2-541adfd0fe29',
  ONSITE_PREPARATION: '713b362b-a4e2-46f8-9017-948a2bd07e88',
  CONSTRUCTION_EXECUTION: '4e556feb-56a2-4e0f-9a7e-7ad7828b4917',
  INSPECTIONS_PAYMENTS: '22009ab1-b940-409f-932f-1e94029440ea',
  FINALISATION: 'd019b93d-124a-403f-90c9-c0ce162756f4',
  HANDOVER_CLOSE: 'c91fcf18-9adc-4ef3-9dab-ff177286fcbf'
} as const

export const STAGE_NAMES = {
  [STAGE_IDS.LEAD_QUALIFICATION]: '1/12 Lead Qualification',
  [STAGE_IDS.INITIAL_CLIENT_MEETING]: '2/12 Initial Client Meeting',
  [STAGE_IDS.QUOTE_PREPARATION]: '3/12 Quote Preparation',
  [STAGE_IDS.QUOTE_SUBMISSION]: '4/12 Quote Submission',
  [STAGE_IDS.CLIENT_DECISION]: '5/12 Client Decision',
  [STAGE_IDS.CONTRACT_DEPOSIT]: '6/12 Contract & Deposit',
  [STAGE_IDS.PLANNING_PROCUREMENT]: '7/12 Planning & Procurement',
  [STAGE_IDS.ONSITE_PREPARATION]: '8/12 On-Site Preparation',
  [STAGE_IDS.CONSTRUCTION_EXECUTION]: '9/12 Construction Execution',
  [STAGE_IDS.INSPECTIONS_PAYMENTS]: '10/12 Inspections & Progress Payments',
  [STAGE_IDS.FINALISATION]: '11/12 Finalisation',
  [STAGE_IDS.HANDOVER_CLOSE]: '12/12 Handover & Close'
} as const

export const STAGE_COLORS = {
  [STAGE_IDS.LEAD_QUALIFICATION]: '#EF4444',
  [STAGE_IDS.INITIAL_CLIENT_MEETING]: '#F97316',
  [STAGE_IDS.QUOTE_PREPARATION]: '#EAB308',
  [STAGE_IDS.QUOTE_SUBMISSION]: '#84CC16',
  [STAGE_IDS.CLIENT_DECISION]: '#22C55E',
  [STAGE_IDS.CONTRACT_DEPOSIT]: '#06B6D4',
  [STAGE_IDS.PLANNING_PROCUREMENT]: '#3B82F6',
  [STAGE_IDS.ONSITE_PREPARATION]: '#6366F1',
  [STAGE_IDS.CONSTRUCTION_EXECUTION]: '#8B5CF6',
  [STAGE_IDS.INSPECTIONS_PAYMENTS]: '#EC4899',
  [STAGE_IDS.FINALISATION]: '#F59E0B',
  [STAGE_IDS.HANDOVER_CLOSE]: '#10B981'
} as const

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  [STAGE_IDS.LEAD_QUALIFICATION]: {
    id: STAGE_IDS.LEAD_QUALIFICATION,
    name: STAGE_NAMES[STAGE_IDS.LEAD_QUALIFICATION],
    description: 'Initial client contact and qualification',
    color: STAGE_COLORS[STAGE_IDS.LEAD_QUALIFICATION],
    sequence_order: 1,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 1,
    max_duration_hours: 24,
    company_id: null
  },
  [STAGE_IDS.INITIAL_CLIENT_MEETING]: {
    id: STAGE_IDS.INITIAL_CLIENT_MEETING,
    name: STAGE_NAMES[STAGE_IDS.INITIAL_CLIENT_MEETING],
    description: 'Schedule and conduct initial site meeting',
    color: STAGE_COLORS[STAGE_IDS.INITIAL_CLIENT_MEETING],
    sequence_order: 2,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 2,
    max_duration_hours: 72,
    company_id: null
  },
  [STAGE_IDS.QUOTE_PREPARATION]: {
    id: STAGE_IDS.QUOTE_PREPARATION,
    name: STAGE_NAMES[STAGE_IDS.QUOTE_PREPARATION],
    description: 'Prepare detailed quote for the project',
    color: STAGE_COLORS[STAGE_IDS.QUOTE_PREPARATION],
    sequence_order: 3,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 4,
    max_duration_hours: 120,
    company_id: null
  },
  [STAGE_IDS.QUOTE_SUBMISSION]: {
    id: STAGE_IDS.QUOTE_SUBMISSION,
    name: STAGE_NAMES[STAGE_IDS.QUOTE_SUBMISSION],
    description: 'Submit quote to client for review',
    color: STAGE_COLORS[STAGE_IDS.QUOTE_SUBMISSION],
    sequence_order: 4,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 1,
    max_duration_hours: 24,
    company_id: null
  },
  [STAGE_IDS.CLIENT_DECISION]: {
    id: STAGE_IDS.CLIENT_DECISION,
    name: STAGE_NAMES[STAGE_IDS.CLIENT_DECISION],
    description: 'Await client decision on quote',
    color: STAGE_COLORS[STAGE_IDS.CLIENT_DECISION],
    sequence_order: 5,
    maps_to_status: 'planning',
    stage_type: 'milestone',
    min_duration_hours: 24,
    max_duration_hours: 168,
    company_id: null
  },
  [STAGE_IDS.CONTRACT_DEPOSIT]: {
    id: STAGE_IDS.CONTRACT_DEPOSIT,
    name: STAGE_NAMES[STAGE_IDS.CONTRACT_DEPOSIT],
    description: 'Finalize contract and collect deposit',
    color: STAGE_COLORS[STAGE_IDS.CONTRACT_DEPOSIT],
    sequence_order: 6,
    maps_to_status: 'active',
    stage_type: 'milestone',
    min_duration_hours: 2,
    max_duration_hours: 72,
    company_id: null
  },
  [STAGE_IDS.PLANNING_PROCUREMENT]: {
    id: STAGE_IDS.PLANNING_PROCUREMENT,
    name: STAGE_NAMES[STAGE_IDS.PLANNING_PROCUREMENT],
    description: 'Order materials and book subcontractors',
    color: STAGE_COLORS[STAGE_IDS.PLANNING_PROCUREMENT],
    sequence_order: 7,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 8,
    max_duration_hours: 120,
    company_id: null
  },
  [STAGE_IDS.ONSITE_PREPARATION]: {
    id: STAGE_IDS.ONSITE_PREPARATION,
    name: STAGE_NAMES[STAGE_IDS.ONSITE_PREPARATION],
    description: 'Site preparation and material delivery',
    color: STAGE_COLORS[STAGE_IDS.ONSITE_PREPARATION],
    sequence_order: 8,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 4,
    max_duration_hours: 48,
    company_id: null
  },
  [STAGE_IDS.CONSTRUCTION_EXECUTION]: {
    id: STAGE_IDS.CONSTRUCTION_EXECUTION,
    name: STAGE_NAMES[STAGE_IDS.CONSTRUCTION_EXECUTION],
    description: 'Active construction phase',
    color: STAGE_COLORS[STAGE_IDS.CONSTRUCTION_EXECUTION],
    sequence_order: 9,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 40,
    max_duration_hours: 720,
    company_id: null
  },
  [STAGE_IDS.INSPECTIONS_PAYMENTS]: {
    id: STAGE_IDS.INSPECTIONS_PAYMENTS,
    name: STAGE_NAMES[STAGE_IDS.INSPECTIONS_PAYMENTS],
    description: 'Required inspections and progress payments',
    color: STAGE_COLORS[STAGE_IDS.INSPECTIONS_PAYMENTS],
    sequence_order: 10,
    maps_to_status: 'active',
    stage_type: 'milestone',
    min_duration_hours: 4,
    max_duration_hours: 72,
    company_id: null
  },
  [STAGE_IDS.FINALISATION]: {
    id: STAGE_IDS.FINALISATION,
    name: STAGE_NAMES[STAGE_IDS.FINALISATION],
    description: 'Final touches and client walkthrough',
    color: STAGE_COLORS[STAGE_IDS.FINALISATION],
    sequence_order: 11,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 8,
    max_duration_hours: 72,
    company_id: null
  },
  [STAGE_IDS.HANDOVER_CLOSE]: {
    id: STAGE_IDS.HANDOVER_CLOSE,
    name: STAGE_NAMES[STAGE_IDS.HANDOVER_CLOSE],
    description: 'Final handover and project completion',
    color: STAGE_COLORS[STAGE_IDS.HANDOVER_CLOSE],
    sequence_order: 12,
    maps_to_status: 'completed',
    stage_type: 'milestone',
    min_duration_hours: 2,
    max_duration_hours: 24,
    company_id: null
  }
}

export const DEFAULT_STAGE_ID = STAGE_IDS.LEAD_QUALIFICATION

export const STAGES_ARRAY: StageDefinition[] = Object.values(STAGE_DEFINITIONS)

export const STAGE_QUESTIONS: StageQuestion[] = [
  {
    id: '650e8400-e29b-41d4-a716-446655440001',
    stage_id: STAGE_IDS.LEAD_QUALIFICATION,
    question_text: 'Have you qualified this lead as a viable opportunity?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Consider budget, timeline, and project scope',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440002',
    stage_id: STAGE_IDS.LEAD_QUALIFICATION,
    question_text: 'What is the estimated project value?',
    response_type: 'number',
    sequence_order: 2,
    help_text: 'Enter rough estimate in dollars',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440003',
    stage_id: STAGE_IDS.LEAD_QUALIFICATION,
    question_text: 'When does the client want to start?',
    response_type: 'date',
    sequence_order: 3,
    help_text: 'Ideal project start date',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440004',
    stage_id: STAGE_IDS.INITIAL_CLIENT_MEETING,
    question_text: 'Have you had your initial meeting with the client?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Face-to-face or video meeting to discuss project',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440005',
    stage_id: STAGE_IDS.INITIAL_CLIENT_MEETING,
    question_text: 'When is the site meeting scheduled?',
    response_type: 'date',
    sequence_order: 2,
    help_text: 'Schedule on-site assessment',
    skip_conditions: { "previous_responses": [{ "question_id": "650e8400-e29b-41d4-a716-446655440004", "response_value": "Yes" }] }
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440006',
    stage_id: STAGE_IDS.INITIAL_CLIENT_MEETING,
    question_text: 'Upload meeting notes or photos',
    response_type: 'file_upload',
    sequence_order: 3,
    help_text: 'Document important details from the meeting',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440007',
    stage_id: STAGE_IDS.QUOTE_PREPARATION,
    question_text: 'Have you completed the site assessment?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Detailed on-site evaluation for accurate quoting',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440008',
    stage_id: STAGE_IDS.QUOTE_PREPARATION,
    question_text: 'Are all materials and labor costs calculated?',
    response_type: 'yes_no',
    sequence_order: 2,
    help_text: 'Ensure comprehensive cost breakdown',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440009',
    stage_id: STAGE_IDS.QUOTE_PREPARATION,
    question_text: 'What is the total quote amount?',
    response_type: 'number',
    sequence_order: 3,
    help_text: 'Final quote amount including all costs and margin',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440010',
    stage_id: STAGE_IDS.QUOTE_SUBMISSION,
    question_text: 'Has the quote been submitted to the client?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Quote formally sent via email or hand-delivered',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440011',
    stage_id: STAGE_IDS.QUOTE_SUBMISSION,
    question_text: 'When do you expect a response?',
    response_type: 'date',
    sequence_order: 2,
    help_text: 'Client indicated decision timeline',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440012',
    stage_id: STAGE_IDS.QUOTE_SUBMISSION,
    question_text: 'Upload quote document',
    response_type: 'file_upload',
    sequence_order: 3,
    help_text: 'Keep copy of submitted quote',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440013',
    stage_id: STAGE_IDS.CLIENT_DECISION,
    question_text: 'Has the client accepted the quote?',
    response_type: 'yes_no',
    sequence_order: 1,
    help_text: 'Client formally agreed to proceed',
    skip_conditions: {}
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440014',
    stage_id: STAGE_IDS.CLIENT_DECISION,
    question_text: 'Are there any requested changes?',
    response_type: 'text',
    sequence_order: 2,
    help_text: 'Document any scope or price modifications',
    skip_conditions: { "previous_responses": [{ "question_id": "650e8400-e29b-41d4-a716-446655440013", "response_value": "Yes" }] }
  },
  {
    id: '650e8400-e29b-41d4-a716-446655440015',
    stage_id: STAGE_IDS.CLIENT_DECISION,
    question_text: 'What is the reason for rejection?',
    response_type: 'text',
    sequence_order: 3,
    help_text: 'Understand why quote was declined',
    skip_conditions: { "previous_responses": [{ "question_id": "650e8400-e29b-41d4-a716-446655440013", "response_value": "No" }] }
  }
]

export const STAGE_TRANSITIONS: StageTransition[] = [
  {
    from_stage_id: STAGE_IDS.LEAD_QUALIFICATION,
    to_stage_id: STAGE_IDS.INITIAL_CLIENT_MEETING,
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440001" },
    is_automatic: true
  },
  {
    from_stage_id: STAGE_IDS.LEAD_QUALIFICATION,
    to_stage_id: STAGE_IDS.HANDOVER_CLOSE,
    trigger_response: 'No',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440001", "action": "close_as_unqualified" },
    is_automatic: false
  },
  {
    from_stage_id: STAGE_IDS.INITIAL_CLIENT_MEETING,
    to_stage_id: STAGE_IDS.QUOTE_PREPARATION,
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440004" },
    is_automatic: true
  },
  {
    from_stage_id: STAGE_IDS.QUOTE_PREPARATION,
    to_stage_id: STAGE_IDS.QUOTE_SUBMISSION,
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440008" },
    is_automatic: true
  },
  {
    from_stage_id: STAGE_IDS.QUOTE_SUBMISSION,
    to_stage_id: STAGE_IDS.CLIENT_DECISION,
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440010" },
    is_automatic: true
  },
  {
    from_stage_id: STAGE_IDS.CLIENT_DECISION,
    to_stage_id: STAGE_IDS.CONTRACT_DEPOSIT,
    trigger_response: 'Yes',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440013" },
    is_automatic: true
  },
  {
    from_stage_id: STAGE_IDS.CLIENT_DECISION,
    to_stage_id: STAGE_IDS.QUOTE_PREPARATION,
    trigger_response: 'No',
    conditions: { "question_id": "650e8400-e29b-41d4-a716-446655440013", "action": "revise_quote" },
    is_automatic: false
  }
]