// Gantt Chart Integration for Question-Driven Job Progression System
// Maps the 12-stage system to the existing 5-status Gantt chart

import { Job, JobStatusHistory, JobStatusTimeline } from '@/lib/types'
import { JobStage, StageAuditLog, EnhancedJob } from '@/lib/types/question-driven'

// Map 12 stages to 5 statuses for Gantt compatibility
export const STAGE_STATUS_MAPPING: Record<string, Job['status']> = {
  // Planning phase
  'planning': 'planning',
  'lead_qualification': 'planning',
  'proposal_creation': 'planning',
  'contract_negotiation': 'planning',
  
  // Active phase
  'active': 'active',
  'project_initiation': 'active',
  'permit_acquisition': 'active',
  'material_procurement': 'active',
  'execution': 'active',
  'quality_control': 'active',
  
  // Completion phase
  'completed': 'completed',
  'final_inspection': 'completed',
  'handover_close': 'completed',
  
  // Other statuses
  'on_hold': 'on_hold',
  'cancelled': 'cancelled'
}

// Enhanced job with stage information
export interface GanttEnhancedJob extends Job {
  current_stage_id?: string
  current_stage?: JobStage
  stage_entered_at?: string
  stage_audit_history?: StageAuditLog[]
}

// Convert stage audit log to Gantt-compatible status history
export function convertStageAuditToStatusHistory(
  auditLog: StageAuditLog[],
  job: GanttEnhancedJob
): JobStatusHistory[] {
  const statusHistory: JobStatusHistory[] = []
  
  // Group audit entries by the status they map to
  const statusGroups = new Map<string, StageAuditLog[]>()
  
  auditLog.forEach(entry => {
    const mappedStatus = entry.to_stage?.maps_to_status || 'planning'
    if (!statusGroups.has(mappedStatus)) {
      statusGroups.set(mappedStatus, [])
    }
    statusGroups.get(mappedStatus)!.push(entry)
  })
  
  // Create status history entries
  let previousEntry: JobStatusHistory | null = null
  
  for (const [status, entries] of statusGroups) {
    const firstEntry = entries[0]
    const lastEntry = entries[entries.length - 1]
    
    // Calculate duration
    let durationDays = 0
    if (previousEntry) {
      const prevDate = new Date(previousEntry.changed_at)
      const currentDate = new Date(firstEntry.created_at)
      durationDays = Math.ceil((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
    }
    
    const historyEntry: JobStatusHistory = {
      id: firstEntry.id,
      job_id: job.id,
      status: status as Job['status'],
      changed_at: firstEntry.created_at,
      changed_by: firstEntry.triggered_by || job.created_by,
      changed_by_name: firstEntry.triggered_by_user?.full_name || 'System',
      notes: `Stage transition: ${firstEntry.from_stage?.name || 'Start'} → ${firstEntry.to_stage?.name || 'Unknown'}`,
      duration_days: durationDays,
      is_current: status === job.status && lastEntry === entries[entries.length - 1]
    }
    
    statusHistory.push(historyEntry)
    previousEntry = historyEntry
  }
  
  // If no audit history, create a default entry
  if (statusHistory.length === 0) {
    statusHistory.push({
      id: `default-${job.id}`,
      job_id: job.id,
      status: job.status,
      changed_at: job.created_at,
      changed_by: job.created_by,
      changed_by_name: 'System',
      notes: 'Job created',
      duration_days: 0,
      is_current: true
    })
  }
  
  return statusHistory.sort((a, b) => 
    new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime()
  )
}

// Enhanced status timeline with stage information
export interface EnhancedJobStatusTimeline extends JobStatusTimeline {
  stage_details?: {
    current_stage_name?: string
    current_stage_color?: string
    stages_completed?: number
    total_stages?: number
    stage_progress_percentage?: number
  }
}

// Convert enhanced job to Gantt-compatible timeline
export function createEnhancedStatusTimeline(
  job: GanttEnhancedJob,
  auditLog: StageAuditLog[]
): EnhancedJobStatusTimeline {
  const history = convertStageAuditToStatusHistory(auditLog, job)
  
  // Calculate stage progress
  const stageDetails = job.current_stage ? {
    current_stage_name: job.current_stage.name,
    current_stage_color: job.current_stage.color,
    stages_completed: auditLog.filter(entry => entry.to_stage?.stage_type === 'milestone').length,
    total_stages: 12, // Total stages in the system
    stage_progress_percentage: Math.round((auditLog.length / 12) * 100)
  } : undefined
  
  return {
    job_id: job.id,
    history,
    stage_details
  }
}

// Enhanced Gantt data with stage information
export interface GanttStageSegment {
  stage_id: string
  stage_name: string
  stage_color: string
  status: Job['status']
  startDate: Date
  endDate: Date
  duration_days: number
  is_current: boolean
}

// Create stage segments for Gantt display
export function createGanttStageSegments(
  job: GanttEnhancedJob,
  auditLog: StageAuditLog[]
): GanttStageSegment[] {
  const segments: GanttStageSegment[] = []
  
  if (auditLog.length === 0) {
    // No stage history - create a single segment
    const startDate = job.start_date ? new Date(job.start_date) : new Date()
    const endDate = job.end_date ? new Date(job.end_date) : new Date()
    
    segments.push({
      stage_id: job.current_stage_id || 'unknown',
      stage_name: job.current_stage?.name || 'Unknown Stage',
      stage_color: job.current_stage?.color || '#6B7280',
      status: job.status,
      startDate,
      endDate,
      duration_days: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
      is_current: true
    })
    
    return segments
  }
  
  // Create segments based on audit log
  const jobStartDate = job.start_date ? new Date(job.start_date) : new Date()
  const jobEndDate = job.end_date ? new Date(job.end_date) : new Date()
  
  for (let i = 0; i < auditLog.length; i++) {
    const entry = auditLog[i]
    const nextEntry = auditLog[i + 1]
    
    if (!entry.to_stage) continue
    
    const segmentStartDate = i === 0 ? jobStartDate : new Date(entry.created_at)
    const segmentEndDate = nextEntry ? new Date(nextEntry.created_at) : jobEndDate
    
    segments.push({
      stage_id: entry.to_stage.id,
      stage_name: entry.to_stage.name,
      stage_color: entry.to_stage.color,
      status: entry.to_stage.maps_to_status,
      startDate: segmentStartDate,
      endDate: segmentEndDate,
      duration_days: Math.ceil((segmentEndDate.getTime() - segmentStartDate.getTime()) / (1000 * 60 * 60 * 24)),
      is_current: i === auditLog.length - 1
    })
  }
  
  return segments
}

// Utility function to get stage color by status
export function getStageColorByStatus(status: Job['status']): string {
  const statusColors = {
    planning: '#3B82F6',
    active: '#10B981',
    on_hold: '#F59E0B',
    completed: '#6B7280',
    cancelled: '#EF4444'
  }
  return statusColors[status] || '#6B7280'
}

// Enhanced Gantt task with stage information
export interface EnhancedGanttTask {
  id: string
  title: string
  startDate: Date
  endDate: Date
  expectedEndDate: Date
  status: Job['status']
  progress: number
  color: string
  
  // Stage-specific information
  current_stage_name?: string
  current_stage_color?: string
  stage_segments: GanttStageSegment[]
  stage_progress_percentage?: number
}

// Convert enhanced job to Gantt task
export function convertJobToEnhancedGanttTask(
  job: GanttEnhancedJob,
  auditLog: StageAuditLog[]
): EnhancedGanttTask {
  const startDate = job.start_date ? new Date(job.start_date) : new Date()
  const endDate = job.end_date ? new Date(job.end_date) : new Date()
  const expectedEndDate = job.end_date ? new Date(job.end_date) : new Date()
  
  const stageSegments = createGanttStageSegments(job, auditLog)
  
  // Calculate progress based on stages
  let progress = 0
  if (job.status === 'completed') {
    progress = 100
  } else if (job.status === 'cancelled') {
    progress = 0
  } else {
    // Calculate progress based on stage completion
    const stageProgress = Math.round((auditLog.length / 12) * 100)
    progress = Math.max(5, Math.min(95, stageProgress))
  }
  
  return {
    id: job.id,
    title: job.title,
    startDate,
    endDate,
    expectedEndDate,
    status: job.status,
    progress,
    color: getStageColorByStatus(job.status),
    current_stage_name: job.current_stage?.name,
    current_stage_color: job.current_stage?.color,
    stage_segments: stageSegments,
    stage_progress_percentage: Math.round((auditLog.length / 12) * 100)
  }
}

// API integration helper
export class GanttIntegrationHelper {
  /**
   * Fetch enhanced job data with stage information
   */
  static async fetchEnhancedJobData(jobId: string): Promise<GanttEnhancedJob | null> {
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) return null
      
      const data = await response.json()
      return data.data
    } catch (error) {
      console.error('Error fetching enhanced job data:', error)
      return null
    }
  }
  
  /**
   * Fetch stage audit log for job
   */
  static async fetchStageAuditLog(jobId: string): Promise<StageAuditLog[]> {
    try {
      const response = await fetch(`/api/jobs/${jobId}/audit-history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      
      if (!response.ok) return []
      
      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error('Error fetching stage audit log:', error)
      return []
    }
  }
  
  /**
   * Create enhanced status timeline for Gantt chart
   */
  static async createEnhancedTimeline(jobId: string): Promise<EnhancedJobStatusTimeline | null> {
    const job = await this.fetchEnhancedJobData(jobId)
    if (!job) return null
    
    const auditLog = await this.fetchStageAuditLog(jobId)
    return createEnhancedStatusTimeline(job, auditLog)
  }
  
  /**
   * Convert multiple jobs to enhanced Gantt tasks
   */
  static async convertJobsToGanttTasks(jobs: GanttEnhancedJob[]): Promise<EnhancedGanttTask[]> {
    const tasks: EnhancedGanttTask[] = []
    
    for (const job of jobs) {
      const auditLog = await this.fetchStageAuditLog(job.id)
      const task = convertJobToEnhancedGanttTask(job, auditLog)
      tasks.push(task)
    }
    
    return tasks
  }
}

// Backward compatibility - ensure existing Gantt chart still works
export function createLegacyStatusHistory(
  job: GanttEnhancedJob,
  auditLog: StageAuditLog[]
): JobStatusTimeline {
  const history = convertStageAuditToStatusHistory(auditLog, job)
  
  return {
    job_id: job.id,
    history
  }
}