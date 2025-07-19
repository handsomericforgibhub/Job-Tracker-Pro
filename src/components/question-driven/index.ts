// Question-Driven Job Progression Components
// Mobile-optimized UI components for the question-driven system

export { default as MobileQuestionInterface } from './MobileQuestionInterface'
export { default as MobileTaskList } from './MobileTaskList'
export { default as StageProgressIndicator } from './StageProgressIndicator'
export { default as JobDashboard } from './JobDashboard'
export { default as FileUploadHandler } from './FileUploadHandler'

// Re-export types for convenience
export type {
  QuestionFlowState,
  StageQuestion,
  JobTask,
  TaskStatus,
  QuestionFormData,
  TaskUpdateRequest,
  FileUploadResult,
  EnhancedJob
} from '@/lib/types/question-driven'