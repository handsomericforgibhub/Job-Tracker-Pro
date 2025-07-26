'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Job, JobStatusHistory, JobStatusTimeline } from '@/lib/types'
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns'
import { LIMITS } from '@/config/timeouts'
import { STAGE_COLORS, STAGE_DEFINITIONS, STAGE_IDS } from '@/config/stages'
import { supabase } from '@/lib/supabase'
import { StageAuditLog } from '@/lib/types/question-driven'

interface GanttChartProps {
  jobs: Job[]
  className?: string
}

interface StatusSegment {
  status: string
  color: string
  startDate: Date
  endDate: Date
  duration: number
  stageName?: string
  stageId?: string
}

interface GanttTask {
  id: string
  title: string
  startDate: Date
  endDate: Date
  expectedEndDate: Date
  status: string
  progress: number
  color: string
  statusSegments: StatusSegment[]
}

const statusColors = {
  planning: '#3B82F6', // blue - fallback for non-stage jobs
  active: '#10B981', // green - fallback for non-stage jobs
  on_hold: '#F59E0B', // yellow/orange - fallback for non-stage jobs
  completed: '#6B7280', // gray - fallback for non-stage jobs
  cancelled: '#EF4444', // red - fallback for non-stage jobs
}

const statusLabels = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold', 
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// Helper function to assign default stages based on job status
const getDefaultStageForStatus = (status: string): string => {
  switch (status) {
    case 'planning':
      return STAGE_IDS.LEAD_QUALIFICATION
    case 'active':
      return STAGE_IDS.CONSTRUCTION_EXECUTION
    case 'on_hold':
      return STAGE_IDS.CLIENT_DECISION
    case 'completed':
      return STAGE_IDS.HANDOVER_CLOSE
    case 'cancelled':
      return STAGE_IDS.HANDOVER_CLOSE
    default:
      return STAGE_IDS.LEAD_QUALIFICATION
  }
}

// Utility function to calculate completion status
const calculateCompletionStatus = (job: Job) => {
  // Don't show suffix for completed or cancelled jobs
  if (job.status === 'completed' || job.status === 'cancelled') {
    return null
  }
  
  // Don't show suffix if no end_date (shouldn't happen with new required fields)
  if (!job.end_date) {
    return null
  }
  
  const today = new Date()
  const endDate = new Date(job.end_date)
  const diffInDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  
  return {
    daysLeft: Math.abs(diffInDays),
    isOverdue: diffInDays < 0
  }
}

export function GanttChart({ jobs, className }: GanttChartProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [viewStartDate, setViewStartDate] = useState<Date>(new Date())
  const [viewEndDate, setViewEndDate] = useState<Date>(addDays(new Date(), 90))
  const [timelineScale, setTimelineScale] = useState<'day' | 'week' | 'month'>('day')
  const [statusHistories, setStatusHistories] = useState<Record<string, JobStatusHistory[]>>({})
  const [isLoadingHistories, setIsLoadingHistories] = useState<boolean>(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Function to fetch real status history data from the API
  const fetchStatusHistories = useCallback(async (jobIds: string[]) => {
    if (jobIds.length === 0) return {}

    setIsLoadingHistories(true)
    console.log('📊 Fetching real status histories for jobs:', jobIds)
    
    try {
      // Get auth token from the shared supabase client
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.warn('⚠️ No auth token found, falling back to simulated data')
        return {}
      }

      const histories: Record<string, JobStatusHistory[]> = {}
      
      // Fetch status history for each job concurrently
      const fetchPromises = jobIds.map(async (jobId) => {
        try {
          console.log(`🔄 Fetching status history for job ${jobId}...`)
          const response = await fetch(`/api/jobs/${jobId}/audit-history`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            console.warn(`⚠️ Failed to fetch history for job ${jobId}:`, response.status, await response.text())
            return null
          }

          const auditResponse = await response.json()
          console.log(`✅ Received audit history for job ${jobId}:`, auditResponse)
          
          // The audit history API returns { success: true, data: StageAuditLog[] }
          if (auditResponse.success && auditResponse.data && auditResponse.data.length > 0) {
            const auditLog = auditResponse.data
            console.log(`📊 Processing ${auditLog.length} audit entries for job ${jobId}`)
            
            // Convert audit log entries to JobStatusHistory format
            const jobHistory: JobStatusHistory[] = []
            
            // Add initial stage entry if there was a from_stage in the first transition
            if (auditLog.length > 0 && auditLog[0].from_stage) {
              const firstEntry = auditLog[0]
              const firstTransitionDate = new Date(firstEntry.created_at)
              const jobCreatedAt = new Date(firstEntry.created_at) // Approximate job start as first transition
              
              const initialDuration = Math.ceil((firstTransitionDate.getTime() - jobCreatedAt.getTime()) / (1000 * 60 * 60 * 24)) || 1
              
              jobHistory.push({
                id: `initial-${jobId}`,
                job_id: jobId,
                status: firstEntry.from_stage.maps_to_status,
                changed_at: jobCreatedAt.toISOString(),
                changed_by: firstEntry.triggered_by,
                changed_by_name: 'Initial',
                duration_days: initialDuration,
                is_current: false,
                stage_id: firstEntry.from_stage.id,
                stage_name: firstEntry.from_stage.name
              })
              
              console.log(`📝 Added initial stage: ${firstEntry.from_stage.name}`)
            }
            
            // Add entries for each stage transition
            for (let i = 0; i < auditLog.length; i++) {
              const entry = auditLog[i]
              const nextEntry = auditLog[i + 1]
              
              if (entry.to_stage) {
                // Calculate duration to next stage
                let durationDays = 0
                if (nextEntry) {
                  const currentDate = new Date(entry.created_at)
                  const nextDate = new Date(nextEntry.created_at)
                  durationDays = Math.ceil((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
                } else {
                  // For the current stage, duration is from transition to now
                  const currentDate = new Date(entry.created_at)
                  const now = new Date()
                  durationDays = Math.ceil((now.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)) || 1
                }
                
                jobHistory.push({
                  id: entry.id,
                  job_id: entry.job_id,
                  status: entry.to_stage.maps_to_status,
                  changed_at: entry.created_at,
                  changed_by: entry.triggered_by,
                  changed_by_name: entry.triggered_by_user?.full_name || 'System',
                  duration_days: durationDays,
                  is_current: i === auditLog.length - 1,
                  stage_id: entry.to_stage.id,
                  stage_name: entry.to_stage.name
                })
                
                console.log(`📝 Added stage transition: ${entry.to_stage.name} (${durationDays} days)`)
              }
            }
            
            if (jobHistory.length > 0) {
              histories[jobId] = jobHistory
              console.log(`✅ Converted ${jobHistory.length} audit entries to history for job ${jobId}`)
            } else {
              console.log(`📊 No valid stage transitions found in audit log for job ${jobId}`)
            }
          } else {
            console.log(`📄 No audit history found for job ${jobId}, will use fallback`)
          }
          
          return { jobId, success: true }
        } catch (error) {
          console.error(`❌ Error fetching history for job ${jobId}:`, error)
          return { jobId, success: false, error }
        }
      })

      await Promise.allSettled(fetchPromises)
      console.log(`📊 Successfully fetched histories for ${Object.keys(histories).length}/${jobIds.length} jobs`)
      
      return histories
    } catch (error) {
      console.error('❌ Error in fetchStatusHistories:', error)
      return {}
    } finally {
      setIsLoadingHistories(false)
    }
  }, [])

  // Memoize jobs with stages to prevent infinite re-renders
  const jobsWithStages = useMemo(() => {
    return jobs.map(job => {
      // If job doesn't have current_stage, auto-assign based on status
      if (!job.current_stage && job.status) {
        const defaultStageId = getDefaultStageForStatus(job.status)
        const defaultStage = STAGE_DEFINITIONS[defaultStageId]
        if (defaultStage) {
          return {
            ...job,
            current_stage: defaultStage
          }
        }
      }
      return job
    })
  }, [jobs])

  // Function to refresh status histories (useful after stage transitions)
  const refreshStatusHistories = useCallback(() => {
    if (!jobsWithStages || jobsWithStages.length === 0) return
    
    const jobIds = jobsWithStages.map(job => job.id)
    if (jobIds.length > 0) {
      console.log('🔄 Manually refreshing status histories...')
      fetchStatusHistories(jobIds).then(fetchedHistories => {
        const completeHistories: Record<string, JobStatusHistory[]> = {}
        
        for (const job of jobsWithStages) {
          if (fetchedHistories[job.id] && fetchedHistories[job.id].length > 0) {
            completeHistories[job.id] = fetchedHistories[job.id]
          } else {
            completeHistories[job.id] = [{
              id: `fallback-${job.id}`,
              job_id: job.id,
              status: job.status,
              changed_at: job.start_date || job.created_at,
              changed_by: job.created_by,
              changed_by_name: 'System',
              duration_days: 0,
              is_current: true,
              stage_id: job.current_stage?.id || null,
              stage_name: job.current_stage?.name || null
            }]
          }
        }
        
        setStatusHistories(completeHistories)
      })
    }
  }, [jobsWithStages, fetchStatusHistories])
  
  console.log('📊 GanttChart processed jobs:', jobsWithStages.length, jobsWithStages.map(j => ({ 
    id: j.id, 
    title: j.title, 
    status: j.status, 
    start_date: j.start_date, 
    end_date: j.end_date,
    current_stage: j.current_stage ? {
      id: j.current_stage.id,
      name: j.current_stage.name,
      color: j.current_stage.color
    } : null
  })))

  // Effect to fetch real status histories when jobs change
  useEffect(() => {
    if (!jobsWithStages || jobsWithStages.length === 0) return
    
    const jobIds = jobsWithStages.map(job => job.id)
    
    if (jobIds.length > 0) {
      fetchStatusHistories(jobIds).then(fetchedHistories => {
        // Merge fetched histories with fallbacks for jobs without history
        const completeHistories: Record<string, JobStatusHistory[]> = {}
        
        for (const job of jobsWithStages) {
          if (fetchedHistories[job.id] && fetchedHistories[job.id].length > 0) {
            // Use real fetched history
            completeHistories[job.id] = fetchedHistories[job.id]
            console.log(`✅ Using real history for job: ${job.title} (${fetchedHistories[job.id].length} entries)`)
            
            // Debug Test Job 2 history specifically
            if (job.title?.includes('Test Job 2 20250721')) {
              console.log(`🔍 Test Job 2 history details:`, fetchedHistories[job.id])
            }
          } else {
            // Create fallback history for jobs without stage progression
            console.log(`📄 Creating fallback history for job: ${job.title} (no audit log data)`)
            completeHistories[job.id] = [{
              id: `fallback-${job.id}`,
              job_id: job.id,
              status: job.status,
              changed_at: job.start_date || job.created_at,
              changed_by: job.created_by,
              changed_by_name: 'System',
              duration_days: 0,
              is_current: true,
              stage_id: job.current_stage?.id || null,
              stage_name: job.current_stage?.name || null
            }]
          }
        }
        
        setStatusHistories(completeHistories)
        console.log('📊 Status histories updated:', Object.keys(completeHistories).length, 'jobs')
      })
    }
  }, [jobsWithStages, fetchStatusHistories])

  // Create stage-based segments for a job based on its progression history
  const createStatusSegments = (job: Job, history: JobStatusHistory[]): StatusSegment[] => {
    // Debug Test Job 2 specifically
    if (job.title?.includes('Test Job 2 20250721')) {
      console.log(`🔍 Creating segments for Test Job 2:`, {
        job_title: job.title,
        current_stage: job.current_stage?.name,
        history_length: history?.length || 0,
        history: history
      })
    }
    if (!history || history.length === 0) {
      // Fallback to current status
      const startDate = job.start_date ? new Date(job.start_date) : new Date()
      const endDate = job.end_date ? new Date(job.end_date) : addDays(startDate, 30)
      
      // Use stage color if available, otherwise fallback to status color
      const fallbackColor = job.current_stage?.color || statusColors[job.status as keyof typeof statusColors] || '#6B7280'
      return [{
        status: job.status,
        color: fallbackColor,
        startDate,
        endDate,
        duration: differenceInDays(endDate, startDate),
        stageName: job.current_stage?.name,
        stageId: job.current_stage?.id
      }]
    }

    const segments: StatusSegment[] = []
    const jobStartDate = job.start_date ? new Date(job.start_date) : new Date()
    const jobEndDate = job.end_date ? new Date(job.end_date) : addDays(jobStartDate, 30)
    const today = new Date()

    console.log(`📊 Creating segments for job "${job.title}" with ${history.length} history entries:`)
    console.log(`📊 Job dates: start=${job.start_date}, end=${job.end_date}`)
    console.log(`📊 History entries:`, history.map((h, i) => ({
      index: i,
      stage_name: h.stage_name,
      status: h.status,
      changed_at: h.changed_at,
      is_current: h.is_current
    })))

    for (let i = 0; i < history.length; i++) {
      const currentStage = history[i]
      const nextStage = history[i + 1]
      
      // Get stage definition for color
      const stageDefinition = currentStage.stage_id ? 
        STAGE_DEFINITIONS[currentStage.stage_id] : null
      
      // Determine segment start date
      const segmentStartDate = i === 0 ? 
        jobStartDate : 
        new Date(currentStage.changed_at)
      
      // Determine segment end date
      let segmentEndDate: Date
      if (nextStage) {
        // Previous stages end exactly when the next stage begins
        segmentEndDate = new Date(nextStage.changed_at)
      } else {
        // Last segment (current stage) - handle carefully to avoid overlap
        if (job.status === 'completed' || job.status === 'cancelled') {
          segmentEndDate = jobEndDate
        } else {
          // For active jobs, current stage extends to today (but not beyond job end date)
          segmentEndDate = today < jobEndDate ? today : jobEndDate
        }
      }

      console.log(`📊 Segment ${i}: "${currentStage.stage_name}" from ${format(segmentStartDate, 'MMM dd')} to ${format(segmentEndDate, 'MMM dd')}`)

      // Only add segments within the job's timeline
      if (segmentStartDate <= jobEndDate && segmentEndDate >= jobStartDate) {
        // Priority: 1. Database stage color from job, 2. Database stage color from audit, 3. Config fallback, 4. Status color
        let segmentColor = '#6B7280' // Default fallback
        
        // PRIORITY 1: If this is the current stage, use job.current_stage.color (database authoritative)
        if (currentStage.is_current && job.current_stage?.color) {
          segmentColor = job.current_stage.color
          console.log(`🎨 Using current stage color from job: ${segmentColor} for "${currentStage.stage_name}"`)  
        }
        // PRIORITY 2: If we have stage_id from audit log, try to find matching job with that stage
        else if (currentStage.stage_id) {
          const jobWithMatchingStage = jobsWithStages.find(j => j.current_stage?.id === currentStage.stage_id)
          if (jobWithMatchingStage?.current_stage?.color) {
            segmentColor = jobWithMatchingStage.current_stage.color
            console.log(`🎨 Using database color from matching job: ${segmentColor} for "${currentStage.stage_name}"`)  
          }
          // PRIORITY 3: Fallback to hardcoded config colors only if no database color found
          else if (STAGE_COLORS[currentStage.stage_id as keyof typeof STAGE_COLORS]) {
            segmentColor = STAGE_COLORS[currentStage.stage_id as keyof typeof STAGE_COLORS]
            console.log(`🎨 Using config fallback color: ${segmentColor} for "${currentStage.stage_name}"`)  
          }
          else if (stageDefinition?.color) {
            segmentColor = stageDefinition.color
            console.log(`🎨 Using stage definition color: ${segmentColor} for "${currentStage.stage_name}"`)  
          }
        }
        // PRIORITY 4: Try to find by stage name in definitions
        else if (currentStage.stage_name) {
          const stageByName = Object.values(STAGE_DEFINITIONS).find(s => s.name === currentStage.stage_name)
          if (stageByName) {
            segmentColor = stageByName.color
            console.log(`🎨 Using stage name lookup color: ${segmentColor} for "${currentStage.stage_name}"`)  
          }
        }
        // PRIORITY 5: Final fallback to status colors
        else if (statusColors[currentStage.status as keyof typeof statusColors]) {
          segmentColor = statusColors[currentStage.status as keyof typeof statusColors]
          console.log(`🎨 Using status fallback color: ${segmentColor} for "${currentStage.stage_name}"`)  
        }
        
        console.log(`🎨 Segment color for "${currentStage.stage_name || currentStage.status}": ${segmentColor}`)
        
        segments.push({
          status: currentStage.status,
          color: segmentColor,
          startDate: segmentStartDate,
          endDate: segmentEndDate,
          duration: Math.max(0, differenceInDays(segmentEndDate, segmentStartDate)),
          stageName: stageDefinition?.name || currentStage.stage_name,
          stageId: currentStage.stage_id
        })
      }
    }

    // Final fallback if no segments were created
    if (segments.length === 0) {
      const finalFallbackColor = job.current_stage?.color || statusColors[job.status as keyof typeof statusColors] || '#6B7280'
      return [{
        status: job.status,
        color: finalFallbackColor,
        startDate: jobStartDate,
        endDate: jobEndDate,
        duration: differenceInDays(jobEndDate, jobStartDate),
        stageName: job.current_stage?.name,
        stageId: job.current_stage?.id
      }]
    }
    
    return segments
  }

  useEffect(() => {
    if (Object.keys(statusHistories).length === 0) return

    // Filter jobs that shouldn't appear in Gantt (completed/cancelled > 1 month ago)
    const oneMonthAgo = addDays(new Date(), -30)
    
    const filteredJobs = jobsWithStages.filter(job => {
      if (job.status === 'completed' || job.status === 'cancelled') {
        const endDate = job.end_date ? new Date(job.end_date) : new Date()
        return endDate >= oneMonthAgo
      }
      return true // Show all other jobs
    })

    // Convert jobs to Gantt tasks with status segments
    const ganttTasks: GanttTask[] = filteredJobs.map(job => {
      const startDate = job.start_date ? new Date(job.start_date) : new Date()
      const endDate = job.end_date ? new Date(job.end_date) : addDays(startDate, 30) // Default 30 days if no end date
      const expectedEndDate = job.end_date ? new Date(job.end_date) : addDays(startDate, 30)
      
      // Create status segments
      const history = statusHistories[job.id] || []
      const statusSegments = createStatusSegments(job, history)
      
      // Calculate progress based on status segments and time
      let progress = 0
      const today = new Date()
      
      if (job.status === 'completed') {
        progress = 100
      } else if (job.status === 'cancelled') {
        progress = 0
      } else {
        const totalDuration = Math.max(1, differenceInDays(expectedEndDate, startDate))
        
        if (today < startDate) {
          progress = 0
        } else if (today >= expectedEndDate) {
          progress = 95 // Not 100% since it's not marked complete
        } else {
          const elapsed = Math.max(0, differenceInDays(today, startDate))
          progress = Math.max(5, Math.min(95, (elapsed / totalDuration) * 100))
        }
      }

      // Use stage color as priority, fallback to status colors for non-stage jobs
      const taskColor = job.current_stage?.color || statusColors[job.status as keyof typeof statusColors] || '#6B7280'
      console.log(`🎨 Task color for "${job.title}": ${taskColor} (stage: ${job.current_stage?.name} = ${job.current_stage?.color}, status: ${job.status} = ${statusColors[job.status as keyof typeof statusColors]})`)

      return {
        id: job.id,
        title: job.title,
        startDate,
        endDate,
        expectedEndDate,
        status: job.status,
        progress,
        color: taskColor,
        statusSegments
      }
    })

    setTasks(ganttTasks)

    // Auto-adjust view dates based on jobs
    if (ganttTasks.length > 0) {
      const earliestStart = new Date(Math.min(...ganttTasks.map(task => task.startDate.getTime())))
      const latestEnd = new Date(Math.max(...ganttTasks.map(task => task.expectedEndDate.getTime())))
      
      setViewStartDate(startOfMonth(addDays(earliestStart, -30)))
      setViewEndDate(endOfMonth(addDays(latestEnd, 30)))
    }
  }, [jobsWithStages, statusHistories])

  const generateTimeline = () => {
    const timeline = []
    const dayInterval = eachDayOfInterval({ start: viewStartDate, end: viewEndDate })
    
    if (timelineScale === 'day') {
      return dayInterval.map(date => ({
        date,
        label: format(date, 'MMM dd'),
        isWeekend: date.getDay() === 0 || date.getDay() === 6
      }))
    } else if (timelineScale === 'week') {
      const weeks = []
      for (let i = 0; i < dayInterval.length; i += 7) {
        const weekStart = dayInterval[i]
        weeks.push({
          date: weekStart,
          label: format(weekStart, 'MMM dd'),
          isWeekend: false
        })
      }
      return weeks
    } else {
      // Month scale
      const months = []
      let currentMonth = startOfMonth(viewStartDate)
      while (currentMonth <= viewEndDate) {
        months.push({
          date: currentMonth,
          label: format(currentMonth, 'MMM yyyy'),
          isWeekend: false
        })
        currentMonth = addDays(endOfMonth(currentMonth), 1)
      }
      return months
    }
  }

  const timeline = generateTimeline()
  const dayWidth = timelineScale === 'day' ? 40 : timelineScale === 'week' ? 80 : 120
  const rowHeight = 60
  const headerHeight = 80
  const sidebarWidth = 280
  
  // Calculate dynamic height based on number of jobs
  const minHeight = headerHeight + (tasks.length > 0 ? rowHeight : 100) // Header + at least one row or empty state
  const contentHeight = headerHeight + (tasks.length * rowHeight)
  const maxHeight = LIMITS.GANTT_CHART_MAX_HEIGHT // Maximum height when many jobs
  const dynamicHeight = Math.max(minHeight, Math.min(contentHeight, maxHeight))
  
  // Define column widths
  const jobNameColumnWidth = 200
  const foremanColumnWidth = 150
  const statusColumnWidth = 80
  const totalSidebarWidth = jobNameColumnWidth + foremanColumnWidth + statusColumnWidth

  // Auto-scroll to today when timeline is ready
  useEffect(() => {
    if (timeline.length > 0 && scrollContainerRef.current) {
      const todayIndex = timeline.findIndex(item => 
        format(item.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      )
      if (todayIndex >= 0) {
        const scrollLeft = Math.max(0, todayIndex * dayWidth - 200) // Center today with some offset
        scrollContainerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    }
  }, [timeline.length, dayWidth, viewStartDate, viewEndDate]) // Dependencies ensure it runs when timeline changes

  const getTaskPosition = (task: GanttTask) => {
    const startIndex = timeline.findIndex(item => 
      format(item.date, 'yyyy-MM-dd') === format(task.startDate, 'yyyy-MM-dd')
    )
    const endIndex = timeline.findIndex(item => 
      format(item.date, 'yyyy-MM-dd') === format(task.endDate, 'yyyy-MM-dd')
    )
    
    const startX = startIndex >= 0 ? startIndex * dayWidth : 0
    const endX = endIndex >= 0 ? (endIndex + 1) * dayWidth : startX + dayWidth
    const width = Math.max(dayWidth, endX - startX)

    return { left: startX, width }
  }

  const getExpectedEndPosition = (task: GanttTask) => {
    const expectedIndex = timeline.findIndex(item => 
      format(item.date, 'yyyy-MM-dd') === format(task.expectedEndDate, 'yyyy-MM-dd')
    )
    return expectedIndex >= 0 ? expectedIndex * dayWidth + dayWidth / 2 : 0
  }

  const getSegmentPosition = (segment: StatusSegment) => {
    const startIndex = timeline.findIndex(item => 
      format(item.date, 'yyyy-MM-dd') === format(segment.startDate, 'yyyy-MM-dd')
    )
    const endIndex = timeline.findIndex(item => 
      format(item.date, 'yyyy-MM-dd') === format(segment.endDate, 'yyyy-MM-dd')
    )
    
    const startX = startIndex >= 0 ? startIndex * dayWidth : 0
    const endX = endIndex >= 0 ? (endIndex + 1) * dayWidth : startX + dayWidth
    const width = Math.max(4, endX - startX) // Minimum 4px width for visibility

    return { left: startX, width }
  }

  return (
    <Card className={`${className} overflow-hidden`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Project Timeline</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {tasks.length} jobs displayed • Jobs completed/cancelled over 30 days ago are hidden
              {isLoadingHistories && <span className="ml-2 text-blue-600">• Loading stage histories...</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={refreshStatusHistories}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              disabled={isLoadingHistories}
            >
              {isLoadingHistories ? 'Refreshing...' : 'Refresh'}
            </button>
            <button 
              onClick={() => {
                const todayIndex = timeline.findIndex(item => 
                  format(item.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                )
                if (todayIndex >= 0 && scrollContainerRef.current) {
                  const scrollLeft = Math.max(0, todayIndex * dayWidth - 200) // Center today with some offset
                  scrollContainerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
                }
              }}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >
              Go to Today
            </button>
            <select 
              value={timelineScale} 
              onChange={(e) => setTimelineScale(e.target.value as 'day' | 'week' | 'month')}
              className="px-3 py-1 border border-gray-300 rounded text-sm"
            >
              <option value="day">Daily View</option>
              <option value="week">Weekly View</option>
              <option value="month">Monthly View</option>
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2 bg-gray-50 border-b text-xs">
            {/* Show all 12 stages if any jobs use stages, otherwise show status colors */}
            {jobsWithStages.some(job => job.current_stage) ? (
              // Show stages using actual database colors from jobs
              (() => {
                // Get unique stages from actual jobs with their database colors
                const uniqueStages = new Map<string, { id: string; name: string; color: string; sequence_order: number }>()
                
                jobsWithStages.forEach(job => {
                  if (job.current_stage) {
                    uniqueStages.set(job.current_stage.id, {
                      id: job.current_stage.id,
                      name: job.current_stage.name,
                      color: job.current_stage.color,
                      sequence_order: job.current_stage.sequence_order || 0
                    })
                  }
                })
                
                // Add any missing stages from history with database colors
                Object.values(statusHistories).forEach(history => {
                  history.forEach(h => {
                    if (h.stage_id && h.stage_name && !uniqueStages.has(h.stage_id)) {
                      // For stages in history, try to get color from job data first, fallback to config
                      let stageColor = '#6B7280'
                      const jobWithThisStage = jobsWithStages.find(j => 
                        j.current_stage?.id === h.stage_id || 
                        statusHistories[j.id]?.some(sh => sh.stage_id === h.stage_id)
                      )
                      if (jobWithThisStage?.current_stage?.id === h.stage_id) {
                        stageColor = jobWithThisStage.current_stage.color
                      } else {
                        // Fallback to hardcoded config only if no job data available
                        stageColor = STAGE_DEFINITIONS[h.stage_id]?.color || '#6B7280'
                      }
                      
                      uniqueStages.set(h.stage_id, {
                        id: h.stage_id,
                        name: h.stage_name,
                        color: stageColor,
                        sequence_order: STAGE_DEFINITIONS[h.stage_id]?.sequence_order || 0
                      })
                    }
                  })
                })
                
                // Sort by sequence order and render
                return Array.from(uniqueStages.values())
                  .sort((a, b) => a.sequence_order - b.sequence_order)
                  .map((stage) => (
                    <div key={stage.id} className="flex items-center gap-1">
                      <div 
                        className="w-3 h-3 rounded" 
                        style={{ backgroundColor: stage.color }}
                      />
                      <span>{stage.name}</span>
                    </div>
                  ))
              })()
            ) : (
              /* Show traditional status labels when no jobs use stages */
              Object.entries(statusColors).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: color }}
                  />
                  <span>{statusLabels[status as keyof typeof statusLabels]}</span>
                </div>
              ))
            )}
            <div className="flex items-center gap-1 ml-4">
              <div className="w-3 h-0.5 bg-red-400" />
              <span>Expected End Date</span>
            </div>
            <div className="flex items-center gap-1 ml-4">
              <div className="w-4 h-4 bg-red-100 border border-red-200" />
              <span>Today</span>
            </div>
          </div>

          {/* Gantt Container */}
          <div className="border" style={{ height: `${dynamicHeight}px` }}>
            <div className="flex h-full">
              {/* Fixed Left Column - Job Names & Status */}
              <div 
                className="flex-shrink-0 bg-gray-50 border-r"
                style={{ width: totalSidebarWidth }}
              >
                {/* Headers */}
                <div 
                  className="border-b bg-gray-50 flex font-medium text-sm"
                  style={{ height: headerHeight }}
                >
                  <div 
                    className="flex items-center px-4 border-r border-gray-300"
                    style={{ width: jobNameColumnWidth }}
                  >
                    Job Name
                  </div>
                  <div 
                    className="flex items-center px-4 border-r border-gray-300"
                    style={{ width: foremanColumnWidth }}
                  >
                    Foreman
                  </div>
                  <div 
                    className="flex items-center justify-center px-2"
                    style={{ width: statusColumnWidth }}
                  >
                    Due Status
                  </div>
                </div>
                
                {/* Job Rows */}
                <div className="overflow-y-auto" style={{ height: `${dynamicHeight - headerHeight}px` }}>
                  {tasks.map((task) => {
                    // Find the corresponding job to get the completion status and foreman
                    const job = jobsWithStages.find(j => j.id === task.id)
                    const completionStatus = job ? calculateCompletionStatus(job) : null
                    const foremanName = job?.foreman?.full_name || 'Unassigned'
                    
                    return (
                      <div
                        key={task.id}
                        className="border-b bg-white hover:bg-gray-50 flex"
                        style={{ height: rowHeight }}
                      >
                        {/* Job Name Column */}
                        <div 
                          className="flex items-center px-4 border-r border-gray-200"
                          style={{ width: jobNameColumnWidth }}
                        >
                          <div className="w-full">
                            <div className="font-medium text-sm truncate">{task.title}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span 
                                className="inline-block w-2 h-2 rounded-full"
                                style={{ backgroundColor: job?.current_stage?.color || task.color }}
                              />
                              {job?.current_stage ? 
                                job.current_stage.name : 
                                statusLabels[task.status as keyof typeof statusLabels]
                              }
                            </div>
                          </div>
                        </div>
                        
                        {/* Foreman Column */}
                        <div 
                          className="flex items-center px-4 border-r border-gray-200"
                          style={{ width: foremanColumnWidth }}
                        >
                          <div className="w-full">
                            <div className={`text-sm truncate ${
                              foremanName === 'Unassigned' 
                                ? 'text-gray-400 italic' 
                                : 'text-gray-700'
                            }`}>
                              {foremanName}
                            </div>
                            {job?.foreman?.email && (
                              <div className="text-xs text-gray-500 truncate">
                                {job.foreman.email}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Due Status Column */}
                        <div 
                          className="flex items-center justify-center px-2"
                          style={{ width: statusColumnWidth }}
                        >
                          {completionStatus && (
                            <div className={`text-xs text-center font-medium ${
                              completionStatus.isOverdue 
                                ? 'text-red-600 font-bold' 
                                : 'text-gray-700'
                            }`}>
                              <div>{completionStatus.daysLeft}</div>
                              <div className="text-[10px] leading-tight">
                                day{completionStatus.daysLeft !== 1 ? 's' : ''}
                              </div>
                              <div className="text-[10px] leading-tight">
                                {completionStatus.isOverdue ? 'overdue' : 'left'}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Scrollable Right Column - Timeline */}
              <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-auto"
              >
                {/* Timeline Header */}
                <div 
                  className="sticky top-0 z-20 bg-white border-b"
                  style={{ height: headerHeight }}
                >
                  <div className="flex">
                    {timeline.map((item, index) => {
                      const isToday = format(item.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                      return (
                        <div
                          key={index}
                          className={`flex-shrink-0 border-r text-center py-2 text-xs font-medium ${
                            isToday ? 'bg-red-100 text-red-800' : item.isWeekend ? 'bg-gray-100' : 'bg-white'
                          }`}
                          style={{ width: dayWidth, height: headerHeight }}
                        >
                          <div className="flex flex-col justify-center h-full">
                            {isToday ? <><strong>TODAY</strong><br />{item.label}</> : item.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Task Rows */}
                <div className="relative">
                  {tasks.map((task, rowIndex) => {
                    const position = getTaskPosition(task)
                    const expectedEndX = getExpectedEndPosition(task)
                    
                    return (
                      <div
                        key={task.id}
                        className="relative border-b hover:bg-gray-50"
                        style={{ height: rowHeight }}
                      >
                        {/* Timeline Grid */}
                        <div className="relative w-full h-full">
                          {timeline.map((item, index) => {
                            const isToday = format(item.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                            return (
                              <div
                                key={index}
                                className={`absolute border-r ${
                                  isToday ? 'bg-red-100' : item.isWeekend ? 'bg-gray-50' : ''
                                }`}
                                style={{ 
                                  left: index * dayWidth, 
                                  width: dayWidth, 
                                  height: rowHeight 
                                }}
                              />
                            )
                          })}
                          
                          {/* Multi-Segment Task Bar */}
                          <div
                            className="absolute top-1/2 transform -translate-y-1/2 cursor-pointer"
                            style={{
                              left: position.left,
                              width: position.width,
                              height: 24
                            }}
                            onClick={() => window.location.href = `/dashboard/jobs/${task.id}`}
                          >
                            {/* Status Segments */}
                            {task.statusSegments.map((segment, segmentIndex) => {
                              const segmentPosition = getSegmentPosition(segment)
                              return (
                                <div
                                  key={segmentIndex}
                                  className="absolute rounded shadow-sm border hover:opacity-90 transition-opacity"
                                  style={{
                                    left: segmentPosition.left - position.left,
                                    width: segmentPosition.width,
                                    height: 24,
                                    backgroundColor: segment.color,
                                    opacity: 0.9,
                                    borderRadius: segmentIndex === 0 ? '4px 0 0 4px' : 
                                               segmentIndex === task.statusSegments.length - 1 ? '0 4px 4px 0' : '0'
                                  }}
                                  title={`${segment.stageName || segment.status}\nFrom: ${format(segment.startDate, 'MMM dd, yyyy')}\nTo: ${format(segment.endDate, 'MMM dd, yyyy')}\nDuration: ${segment.duration} days`}
                                />
                              )
                            })}
                            
                            {/* Task Title Overlay */}
                            <div className="absolute inset-0 flex items-center justify-between px-2 text-white text-xs font-medium pointer-events-none">
                              <span className="truncate drop-shadow-sm">{position.width > 80 ? task.title : ''}</span>
                              <span className="drop-shadow-sm">{position.width > 60 ? `${task.progress}%` : ''}</span>
                            </div>
                          </div>

                          {/* Expected End Date Line */}
                          {expectedEndX > 0 && (
                            <div
                              className="absolute bg-red-400 z-10 opacity-80"
                              style={{
                                left: expectedEndX - 1,
                                top: '10%',
                                width: 2,
                                height: '80%'
                              }}
                              title={`Expected end: ${format(task.expectedEndDate, 'MMM dd, yyyy')}`}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Empty State */}
          {tasks.length === 0 && (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="text-center">
                <div className="text-lg font-medium mb-2">No jobs to display</div>
                <div className="text-sm">Jobs will appear here when they are created</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}