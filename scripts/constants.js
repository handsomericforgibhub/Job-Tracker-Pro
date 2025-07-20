/**
 * Shared constants for JavaScript scripts
 * This file mirrors the constants from src/config/constants.ts for use in Node.js scripts
 */

const RESPONSE_TYPES = {
  YES_NO: 'yes_no',
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  FILE_UPLOAD: 'file_upload',
  MULTIPLE_CHOICE: 'multiple_choice'
}

const JOB_STATUSES = {
  PLANNING: 'planning',
  ACTIVE: 'active', 
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
}

const STAGE_TYPES = {
  STANDARD: 'standard',
  MILESTONE: 'milestone',
  APPROVAL: 'approval'
}

module.exports = {
  RESPONSE_TYPES,
  JOB_STATUSES,
  STAGE_TYPES
}