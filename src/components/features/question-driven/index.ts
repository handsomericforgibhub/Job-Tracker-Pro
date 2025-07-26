// Question-Driven Job Progression Components
// Mobile-optimized UI components for the question-driven system

export { default as MobileQuestionInterface } from './mobile-question-interface'
export { default as MobileTaskList } from './mobile-task-list'
export { default as StageProgressIndicator } from './stage-progress-indicator'
export { default as JobDashboard } from './job-dashboard'
export { default as FileUploadHandler } from './file-upload-handler'

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