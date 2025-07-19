'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Job, JobStatusHistory, JobStatusTimeline } from '@/lib/types'
import { format, addDays, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns'

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
  planning: '#3B82F6', // blue
  active: '#10B981', // green
  on_hold: '#F59E0B', // yellow/orange
  completed: '#6B7280', // gray
  cancelled: '#EF4444', // red
}

const statusLabels = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold', 
  completed: 'Completed',
  cancelled: 'Cancelled',
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
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Debug logging
  console.log('📊 GanttChart received jobs:', jobs.length, jobs.map(j => ({ 
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

  // Fetch status history for all jobs (simplified to avoid auth issues)
  const fetchStatusHistories = async () => {
    const histories: Record<string, JobStatusHistory[]> = {}
    
    // For now, create fallback history entries for all jobs based on current status
    // This avoids authentication issues while still showing jobs on the Gantt chart
    for (const job of jobs) {
      console.log(`📊 Creating fallback history for job: ${job.title} (${job.status})`)
      
      histories[job.id] = [{
        id: `fallback-${job.id}`,
        job_id: job.id,
        status: job.status,
        changed_at: job.start_date || job.created_at,
        changed_by: job.created_by,
        changed_by_name: 'System',
        duration_days: 0,
        is_current: true
      }]
    }
    
    console.log('📊 Status histories created:', Object.keys(histories).length, 'jobs')
    setStatusHistories(histories)
  }

  // Create status segments for a job based on its history
  const createStatusSegments = (job: Job, history: JobStatusHistory[]): StatusSegment[] => {
    if (!history || history.length === 0) {
      // Fallback to current status
      const startDate = job.start_date ? new Date(job.start_date) : new Date()
      const endDate = job.end_date ? new Date(job.end_date) : addDays(startDate, 30)
      
      return [{
        status: job.status,
        color: job.current_stage?.color || statusColors[job.status as keyof typeof statusColors] || '#6B7280',
        startDate,
        endDate,
        duration: differenceInDays(endDate, startDate)
      }]
    }

    const segments: StatusSegment[] = []
    const jobStartDate = job.start_date ? new Date(job.start_date) : new Date()
    const jobEndDate = job.end_date ? new Date(job.end_date) : addDays(jobStartDate, 30)

    for (let i = 0; i < history.length; i++) {
      const currentStatus = history[i]
      const nextStatus = history[i + 1]
      
      // Determine segment start date
      // For the first segment, use the job start date or the first status change date, whichever is earlier
      const segmentStartDate = i === 0 ? 
        (jobStartDate < new Date(currentStatus.changed_at) ? jobStartDate : new Date(currentStatus.changed_at)) : 
        new Date(currentStatus.changed_at)
      
      // Determine segment end date
      let segmentEndDate: Date
      if (nextStatus) {
        segmentEndDate = new Date(nextStatus.changed_at)
      } else {
        // Last segment extends to today (for ongoing jobs) or job end date (for completed jobs)
        const today = new Date()
        if (job.status === 'completed' || job.status === 'cancelled') {
          segmentEndDate = jobEndDate
        } else {
          // For ongoing jobs, only extend to today or job end date, whichever is earlier
          segmentEndDate = today < jobEndDate ? today : jobEndDate
        }
      }

      // Only add segments within the job's timeline
      if (segmentStartDate <= jobEndDate && segmentEndDate >= jobStartDate) {
        segments.push({
          status: currentStatus.status,
          color: statusColors[currentStatus.status as keyof typeof statusColors] || '#6B7280',
          startDate: segmentStartDate,
          endDate: segmentEndDate,
          duration: Math.max(0, differenceInDays(segmentEndDate, segmentStartDate))
        })
      }
    }

    return segments.length > 0 ? segments : [{
      status: job.status,
      color: job.current_stage?.color || statusColors[job.status as keyof typeof statusColors] || '#6B7280',
      startDate: jobStartDate,
      endDate: jobEndDate,
      duration: differenceInDays(jobEndDate, jobStartDate)
    }]
  }

  useEffect(() => {
    fetchStatusHistories()
  }, [jobs])

  // Add a refresh function that can be called when job status changes
  const refreshStatusHistories = () => {
    fetchStatusHistories()
  }

  // Refresh status histories when jobs change (including status updates)
  useEffect(() => {
    const jobStatuses = jobs.map(job => `${job.id}-${job.status}-${job.updated_at}`).join(',')
    if (jobStatuses) {
      fetchStatusHistories()
    }
  }, [jobs.map(job => `${job.id}-${job.status}-${job.updated_at}`).join(',')])

  useEffect(() => {
    if (Object.keys(statusHistories).length === 0) return

    // Filter jobs that shouldn't appear in Gantt (completed/cancelled > 1 month ago)
    const oneMonthAgo = addDays(new Date(), -30)
    
    const filteredJobs = jobs.filter(job => {
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

      const taskColor = job.current_stage?.color || statusColors[job.status as keyof typeof statusColors] || '#6B7280'
      console.log(`🎨 Task color for "${job.title}": ${taskColor} (stage: ${job.current_stage?.color}, status: ${statusColors[job.status as keyof typeof statusColors]})`)

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
  }, [jobs, statusHistories])

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
  const maxHeight = 600 // Maximum height when many jobs
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
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b text-xs">
            {/* Show stage names if any jobs have current_stage */}
            {jobs.some(job => job.current_stage) ? (
              Array.from(new Set(jobs.filter(job => job.current_stage).map(job => ({
                name: job.current_stage!.name,
                color: job.current_stage!.color
              })))).map((stage, index) => (
                <div key={index} className="flex items-center gap-1">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: stage.color }}
                  />
                  <span>{stage.name}</span>
                </div>
              ))
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
                    const job = jobs.find(j => j.id === task.id)
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
                                  title={`${statusLabels[segment.status as keyof typeof statusLabels]}\nFrom: ${format(segment.startDate, 'MMM dd, yyyy')}\nTo: ${format(segment.endDate, 'MMM dd, yyyy')}\nDuration: ${segment.duration} days`}
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