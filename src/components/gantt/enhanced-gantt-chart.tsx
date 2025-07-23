'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Job } from '@/lib/types'
import { 
  GanttEnhancedJob, 
  EnhancedGanttTask, 
  GanttStageSegment,
  GanttIntegrationHelper,
  convertJobToEnhancedGanttTask,
  getStageColorByStatus
} from '@/lib/integrations/gantt-integration'
import { StageAuditLog } from '@/lib/types/question-driven'
import { 
  format, 
  addDays, 
  differenceInDays, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval 
} from 'date-fns'

interface EnhancedGanttChartProps {
  jobs: GanttEnhancedJob[]
  showStageDetails?: boolean
  enableStageView?: boolean
  className?: string
}

export default function EnhancedGanttChart({ 
  jobs, 
  showStageDetails = true,
  enableStageView = true,
  className 
}: EnhancedGanttChartProps) {
  const [tasks, setTasks] = useState<EnhancedGanttTask[]>([])
  const [viewStartDate, setViewStartDate] = useState<Date>(new Date())
  const [viewEndDate, setViewEndDate] = useState<Date>(addDays(new Date(), 90))
  const [timelineScale, setTimelineScale] = useState<'day' | 'week' | 'month'>('day')
  const [viewMode, setViewMode] = useState<'status' | 'stage'>('status')
  const [loading, setLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<Record<string, StageAuditLog[]>>({})
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Fetch audit logs for all jobs
  const fetchAuditLogs = async () => {
    setLoading(true)
    const logs: Record<string, StageAuditLog[]> = {}
    
    for (const job of jobs) {
      try {
        const auditLog = await GanttIntegrationHelper.fetchStageAuditLog(job.id)
        logs[job.id] = auditLog
      } catch (error) {
        console.error(`Error fetching audit log for job ${job.id}:`, error)
        logs[job.id] = []
      }
    }
    
    setAuditLogs(logs)
    setLoading(false)
  }

  // Convert jobs to enhanced Gantt tasks
  useEffect(() => {
    if (Object.keys(auditLogs).length === 0) return

    const enhancedTasks: EnhancedGanttTask[] = jobs.map(job => {
      const auditLog = auditLogs[job.id] || []
      return convertJobToEnhancedGanttTask(job, auditLog)
    })

    setTasks(enhancedTasks)

    // Auto-adjust view dates
    if (enhancedTasks.length > 0) {
      const earliestStart = new Date(Math.min(...enhancedTasks.map(task => task.startDate.getTime())))
      const latestEnd = new Date(Math.max(...enhancedTasks.map(task => task.expectedEndDate.getTime())))
      
      setViewStartDate(startOfMonth(addDays(earliestStart, -30)))
      setViewEndDate(endOfMonth(addDays(latestEnd, 30)))
    }
  }, [jobs, auditLogs])

  // Load audit logs when jobs change
  useEffect(() => {
    fetchAuditLogs()
  }, [jobs])

  const generateTimeline = () => {
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

  const getTaskPosition = (task: EnhancedGanttTask) => {
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

  const getSegmentPosition = (segment: GanttStageSegment) => {
    const startIndex = timeline.findIndex(item => 
      format(item.date, 'yyyy-MM-dd') === format(segment.startDate, 'yyyy-MM-dd')
    )
    const endIndex = timeline.findIndex(item => 
      format(item.date, 'yyyy-MM-dd') === format(segment.endDate, 'yyyy-MM-dd')
    )
    
    const startX = startIndex >= 0 ? startIndex * dayWidth : 0
    const endX = endIndex >= 0 ? (endIndex + 1) * dayWidth : startX + dayWidth
    const width = Math.max(4, endX - startX)

    return { left: startX, width }
  }

  // Auto-scroll to today
  useEffect(() => {
    if (timeline.length > 0 && scrollContainerRef.current) {
      const todayIndex = timeline.findIndex(item => 
        format(item.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
      )
      if (todayIndex >= 0) {
        const scrollLeft = Math.max(0, todayIndex * dayWidth - 200)
        scrollContainerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
      }
    }
  }, [timeline.length, dayWidth])

  return (
    <Card className={`${className} overflow-hidden`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Enhanced Project Timeline
              {enableStageView && (
                <Badge variant="secondary" className="text-xs">
                  Stage View Available
                </Badge>
              )}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {tasks.length} jobs displayed with stage progression tracking
            </p>
          </div>
          <div className="flex items-center gap-2">
            {enableStageView && (
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === 'status' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('status')}
                >
                  Status View
                </Button>
                <Button
                  variant={viewMode === 'stage' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('stage')}
                >
                  Stage View
                </Button>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                const todayIndex = timeline.findIndex(item => 
                  format(item.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')
                )
                if (todayIndex >= 0 && scrollContainerRef.current) {
                  const scrollLeft = Math.max(0, todayIndex * dayWidth - 200)
                  scrollContainerRef.current.scrollTo({ left: scrollLeft, behavior: 'smooth' })
                }
              }}
            >
              Go to Today
            </Button>
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
          {/* Enhanced Legend */}
          <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 border-b text-xs">
            <div className="font-medium">Legend:</div>
            {viewMode === 'status' ? (
              // Status legend
              <>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span>Planning</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-yellow-500" />
                  <span>On Hold</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-gray-500" />
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-red-500" />
                  <span>Cancelled</span>
                </div>
              </>
            ) : (
              // Stage legend
              <>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-400" />
                  <span>Planning Stages</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-400" />
                  <span>Execution Stages</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-purple-400" />
                  <span>Completion Stages</span>
                </div>
              </>
            )}
            <div className="flex items-center gap-1 ml-4">
              <div className="w-3 h-0.5 bg-red-400" />
              <span>Expected End</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 bg-red-100 border border-red-200" />
              <span>Today</span>
            </div>
          </div>

          {/* Gantt Container */}
          <div className="border" style={{ height: '600px' }}>
            <div className="flex h-full">
              {/* Fixed Left Column */}
              <div className="flex-shrink-0 bg-gray-50 border-r" style={{ width: '320px' }}>
                {/* Header */}
                <div 
                  className="border-b bg-gray-50 flex font-medium text-sm"
                  style={{ height: headerHeight }}
                >
                  <div className="flex items-center px-4 flex-1">
                    Job Details
                  </div>
                </div>
                
                {/* Job Rows */}
                <div className="overflow-y-auto" style={{ height: `${600 - headerHeight}px` }}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="border-b bg-white hover:bg-gray-50 p-3"
                      style={{ height: rowHeight }}
                    >
                      <div className="flex items-center justify-between h-full">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate mb-1">{task.title}</div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <div 
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: viewMode === 'stage' ? task.current_stage_color : task.color }}
                            />
                            {viewMode === 'stage' && task.current_stage_name ? (
                              <span>{task.current_stage_name}</span>
                            ) : (
                              <span>{task.status}</span>
                            )}
                          </div>
                          {showStageDetails && task.stage_progress_percentage !== undefined && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 transition-all duration-300"
                                  style={{ width: `${task.stage_progress_percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{task.stage_progress_percentage}%</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Scrollable Timeline */}
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
                  {tasks.map((task) => {
                    const position = getTaskPosition(task)
                    
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
                          
                          {/* Task Bar */}
                          <div
                            className="absolute top-1/2 transform -translate-y-1/2 cursor-pointer"
                            style={{
                              left: position.left,
                              width: position.width,
                              height: 24
                            }}
                            onClick={() => window.location.href = `/dashboard/jobs/${task.id}`}
                          >
                            {viewMode === 'stage' && task.stage_segments.length > 0 ? (
                              // Stage segments with enhanced visual separation
                              task.stage_segments.map((segment, segmentIndex) => {
                                const segmentPosition = getSegmentPosition(segment)
                                const isFirstSegment = segmentIndex === 0
                                const isLastSegment = segmentIndex === task.stage_segments.length - 1
                                const isSameDayTransition = segmentPosition.width <= dayWidth
                                
                                return (
                                  <React.Fragment key={segmentIndex}>
                                    <div
                                      className="absolute shadow-sm border hover:opacity-90 transition-opacity"
                                      style={{
                                        left: segmentPosition.left - position.left,
                                        width: Math.max(4, segmentPosition.width - (isLastSegment ? 0 : 1)), // Add 1px gap between segments
                                        height: 24,
                                        backgroundColor: segment.stage_color,
                                        opacity: segment.is_current ? 1.0 : 0.85,
                                        borderRadius: isFirstSegment ? '4px 0 0 4px' : 
                                                     isLastSegment ? '0 4px 4px 0' : '0',
                                        borderRight: !isLastSegment ? `2px solid white` : 'none', // Visual separator
                                        zIndex: segment.is_current ? 12 : 10
                                      }}
                                      title={`${segment.stage_name}\nFrom: ${format(segment.startDate, 'MMM dd, yyyy HH:mm')}\nTo: ${format(segment.endDate, 'MMM dd, yyyy HH:mm')}\nDuration: ${segment.duration_days} day${segment.duration_days !== 1 ? 's' : ''}`}
                                    />
                                    
                                    {/* Add visual break for same-day transitions */}
                                    {isSameDayTransition && !isLastSegment && (
                                      <div
                                        className="absolute bg-white"
                                        style={{
                                          left: segmentPosition.left - position.left + segmentPosition.width - 1,
                                          width: 2,
                                          height: 24,
                                          zIndex: 15
                                        }}
                                        title="Stage transition"
                                      />
                                    )}
                                  </React.Fragment>
                                )
                              })
                            ) : (
                              // Single status bar
                              <div
                                className="absolute inset-0 rounded shadow-sm border hover:opacity-90 transition-opacity"
                                style={{
                                  backgroundColor: task.color,
                                  opacity: 0.9
                                }}
                              />
                            )}
                            
                            {/* Task Title Overlay */}
                            <div className="absolute inset-0 flex items-center justify-between px-2 text-white text-xs font-medium pointer-events-none">
                              <span className="truncate drop-shadow-sm">{position.width > 80 ? task.title : ''}</span>
                              <span className="drop-shadow-sm">{position.width > 60 ? `${task.progress}%` : ''}</span>
                            </div>
                          </div>
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
                <div className="text-sm">Jobs will appear here when they are created with stage progression</div>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <div className="text-sm text-gray-600">Loading stage data...</div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}