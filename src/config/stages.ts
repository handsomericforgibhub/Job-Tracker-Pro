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
  LEAD_QUALIFICATION: '550e8400-e29b-41d4-a716-446655440001',
  INITIAL_CLIENT_MEETING: '550e8400-e29b-41d4-a716-446655440002',
  QUOTE_PREPARATION: '550e8400-e29b-41d4-a716-446655440003',
  QUOTE_SUBMISSION: '550e8400-e29b-41d4-a716-446655440004',
  CLIENT_DECISION: '550e8400-e29b-41d4-a716-446655440005',
  CONTRACT_DEPOSIT: '550e8400-e29b-41d4-a716-446655440006',
  PLANNING_PROCUREMENT: '550e8400-e29b-41d4-a716-446655440007',
  ONSITE_PREPARATION: '550e8400-e29b-41d4-a716-446655440008',
  CONSTRUCTION_EXECUTION: '550e8400-e29b-41d4-a716-446655440009',
  INSPECTIONS_PAYMENTS: '550e8400-e29b-41d4-a716-446655440010',
  FINALISATION: '550e8400-e29b-41d4-a716-446655440011',
  HANDOVER_CLOSE: '550e8400-e29b-41d4-a716-446655440012'
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
  [STAGE_IDS.LEAD_QUALIFICATION]: '#C7D2FE',
  [STAGE_IDS.INITIAL_CLIENT_MEETING]: '#A5B4FC',
  [STAGE_IDS.QUOTE_PREPARATION]: '#93C5FD',
  [STAGE_IDS.QUOTE_SUBMISSION]: '#60A5FA',
  [STAGE_IDS.CLIENT_DECISION]: '#38BDF8',
  [STAGE_IDS.CONTRACT_DEPOSIT]: '#34D399',
  [STAGE_IDS.PLANNING_PROCUREMENT]: '#4ADE80',
  [STAGE_IDS.ONSITE_PREPARATION]: '#FACC15',
  [STAGE_IDS.CONSTRUCTION_EXECUTION]: '#FB923C',
  [STAGE_IDS.INSPECTIONS_PAYMENTS]: '#F87171',
  [STAGE_IDS.FINALISATION]: '#F472B6',
  [STAGE_IDS.HANDOVER_CLOSE]: '#D1D5DB'
} as const

export const STAGE_DEFINITIONS: Record<string, StageDefinition> = {
  [STAGE_IDS.LEAD_QUALIFICATION]: {
    id: STAGE_IDS.LEAD_QUALIFICATION,
    name: STAGE_NAMES[STAGE_IDS.LEAD_QUALIFICATION],
    description: 'Initial assessment of lead viability and requirements',
    color: STAGE_COLORS[STAGE_IDS.LEAD_QUALIFICATION],
    sequence_order: 1,
    maps_to_status: 'planning',
    stage_type: 'standard',
    min_duration_hours: 1,
    max_duration_hours: 168,
    company_id: null
  },
  [STAGE_IDS.INITIAL_CLIENT_MEETING]: {
    id: STAGE_IDS.INITIAL_CLIENT_MEETING,
    name: STAGE_NAMES[STAGE_IDS.INITIAL_CLIENT_MEETING],
    description: 'First meeting with client to understand project scope',
    color: STAGE_COLORS[STAGE_IDS.INITIAL_CLIENT_MEETING],
    sequence_order: 2,
    maps_to_status: 'planning',
    stage_type: 'milestone',
    min_duration_hours: 2,
    max_duration_hours: 72,
    company_id: null
  },
  [STAGE_IDS.QUOTE_PREPARATION]: {
    id: STAGE_IDS.QUOTE_PREPARATION,
    name: STAGE_NAMES[STAGE_IDS.QUOTE_PREPARATION],
    description: 'Prepare detailed project quote and estimates',
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
    description: 'Submit quote to client and await response',
    color: STAGE_COLORS[STAGE_IDS.QUOTE_SUBMISSION],
    sequence_order: 4,
    maps_to_status: 'planning',
    stage_type: 'milestone',
    min_duration_hours: 1,
    max_duration_hours: 336,
    company_id: null
  },
  [STAGE_IDS.CLIENT_DECISION]: {
    id: STAGE_IDS.CLIENT_DECISION,
    name: STAGE_NAMES[STAGE_IDS.CLIENT_DECISION],
    description: 'Client reviews and makes decision on quote',
    color: STAGE_COLORS[STAGE_IDS.CLIENT_DECISION],
    sequence_order: 5,
    maps_to_status: 'planning',
    stage_type: 'approval',
    min_duration_hours: 1,
    max_duration_hours: 168,
    company_id: null
  },
  [STAGE_IDS.CONTRACT_DEPOSIT]: {
    id: STAGE_IDS.CONTRACT_DEPOSIT,
    name: STAGE_NAMES[STAGE_IDS.CONTRACT_DEPOSIT],
    description: 'Finalize contract terms and collect deposit',
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
    description: 'Detailed planning and material procurement',
    color: STAGE_COLORS[STAGE_IDS.PLANNING_PROCUREMENT],
    sequence_order: 7,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 8,
    max_duration_hours: 168,
    company_id: null
  },
  [STAGE_IDS.ONSITE_PREPARATION]: {
    id: STAGE_IDS.ONSITE_PREPARATION,
    name: STAGE_NAMES[STAGE_IDS.ONSITE_PREPARATION],
    description: 'Site preparation and setup for construction',
    color: STAGE_COLORS[STAGE_IDS.ONSITE_PREPARATION],
    sequence_order: 8,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 4,
    max_duration_hours: 72,
    company_id: null
  },
  [STAGE_IDS.CONSTRUCTION_EXECUTION]: {
    id: STAGE_IDS.CONSTRUCTION_EXECUTION,
    name: STAGE_NAMES[STAGE_IDS.CONSTRUCTION_EXECUTION],
    description: 'Main construction and building phase',
    color: STAGE_COLORS[STAGE_IDS.CONSTRUCTION_EXECUTION],
    sequence_order: 9,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 40,
    max_duration_hours: 2000,
    company_id: null
  },
  [STAGE_IDS.INSPECTIONS_PAYMENTS]: {
    id: STAGE_IDS.INSPECTIONS_PAYMENTS,
    name: STAGE_NAMES[STAGE_IDS.INSPECTIONS_PAYMENTS],
    description: 'Quality inspections and progress billing',
    color: STAGE_COLORS[STAGE_IDS.INSPECTIONS_PAYMENTS],
    sequence_order: 10,
    maps_to_status: 'active',
    stage_type: 'milestone',
    min_duration_hours: 2,
    max_duration_hours: 48,
    company_id: null
  },
  [STAGE_IDS.FINALISATION]: {
    id: STAGE_IDS.FINALISATION,
    name: STAGE_NAMES[STAGE_IDS.FINALISATION],
    description: 'Final touches and completion preparations',
    color: STAGE_COLORS[STAGE_IDS.FINALISATION],
    sequence_order: 11,
    maps_to_status: 'active',
    stage_type: 'standard',
    min_duration_hours: 8,
    max_duration_hours: 120,
    company_id: null
  },
  [STAGE_IDS.HANDOVER_CLOSE]: {
    id: STAGE_IDS.HANDOVER_CLOSE,
    name: STAGE_NAMES[STAGE_IDS.HANDOVER_CLOSE],
    description: 'Final handover and project closure',
    color: STAGE_COLORS[STAGE_IDS.HANDOVER_CLOSE],
    sequence_order: 12,
    maps_to_status: 'completed',
    stage_type: 'milestone',
    min_duration_hours: 1,
    max_duration_hours: 24,
    company_id: null
  }
}

export const DEFAULT_STAGE_ID = STAGE_IDS.LEAD_QUALIFICATION

export const STAGES_ARRAY: StageDefinition[] = Object.values(STAGE_DEFINITIONS)

export const STAGE_QUESTIONS: StageQuestion[] = [
  // This array will be dynamically loaded from the database
  // The database contains the authoritative version of stage questions
  // See database-scripts/31-seed-initial-stages-data-refactored-safe.sql for the complete list
]

export const STAGE_TRANSITIONS: StageTransition[] = [
  // This array will be dynamically loaded from the database
  // The database contains the authoritative version of stage transitions
  // See database-scripts/31-seed-initial-stages-data-refactored-safe.sql for the complete list
]