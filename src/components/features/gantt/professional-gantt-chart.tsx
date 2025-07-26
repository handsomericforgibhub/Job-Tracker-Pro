'use client'

import { useEffect, useState } from 'react'
import { Gantt } from 'wx-react-gantt'
import 'wx-react-gantt/dist/gantt.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Job } from '@/lib/types'
import { format, addDays, differenceInDays } from 'date-fns'

interface ProfessionalGanttChartProps {
  jobs: Job[]
  className?: string
}

interface GanttTask {
  id: number
  text: string
  start: Date
  end: Date
  duration: number
  progress: number
  type: string
  parent?: number
}

interface GanttLink {
  id: number
  source: number
  target: number
  type: string
}

const statusColors = {
  planning: '#3B82F6', // blue
  active: '#10B981', // green
  on_hold: '#F59E0B', // yellow/orange
  completed: '#6B7280', // gray
  cancelled: '#EF4444', // red
}

export function ProfessionalGanttChart({ jobs, className }: ProfessionalGanttChartProps) {
  const [tasks, setTasks] = useState<GanttTask[]>([])
  const [links, setLinks] = useState<GanttLink[]>([])

  useEffect(() => {
    // Filter jobs that shouldn't appear in Gantt (completed/cancelled > 1 month ago)
    const oneMonthAgo = addDays(new Date(), -30)
    
    const filteredJobs = jobs.filter(job => {
      if (job.status === 'completed' || job.status === 'cancelled') {
        const endDate = job.end_date ? new Date(job.end_date) : new Date()
        return endDate >= oneMonthAgo
      }
      return true // Show all other jobs
    })

    // Convert jobs to SVAR Gantt tasks
    const ganttTasks: GanttTask[] = filteredJobs.map((job, index) => {
      const startDate = job.start_date ? new Date(job.start_date) : new Date()
      const endDate = job.end_date ? new Date(job.end_date) : addDays(startDate, 30)
      
      // Calculate progress based on status and elapsed time
      let progress = 0
      const today = new Date()
      const totalDuration = differenceInDays(endDate, startDate)
      
      switch (job.status) {
        case 'planning':
          progress = 0
          break
        case 'active':
          if (today < startDate) {
            progress = 0
          } else if (today >= endDate) {
            progress = 95 // Nearly complete but not marked as done
          } else {
            const elapsed = differenceInDays(today, startDate)
            progress = Math.max(5, Math.min(90, (elapsed / totalDuration) * 100))
          }
          break
        case 'completed':
          progress = 100
          break
        case 'cancelled':
          progress = 0
          break
        case 'on_hold':
          if (today < startDate) {
            progress = 0
          } else {
            const elapsed = differenceInDays(today, startDate)
            progress = Math.max(5, Math.min(40, (elapsed / totalDuration) * 100)) // Cap at 40% for on-hold
          }
          break
        default:
          progress = 0
      }

      return {
        id: parseInt(job.id.replace(/\D/g, '')) || index + 1, // Convert ID to number, fallback to index
        text: job.title,
        start: startDate,
        end: endDate,
        duration: Math.max(1, totalDuration),
        progress: Math.round(progress),
        type: job.status === 'completed' ? 'milestone' : 'task'
      }
    })

    setTasks(ganttTasks)
    setLinks([]) // No dependencies for now, can be added later

  }, [jobs])

  const scales = [
    { unit: 'month', step: 1, format: 'MMMM yyyy' },
    { unit: 'day', step: 1, format: 'dd' }
  ]

  const columns = [
    { name: 'text', label: 'Job Name', width: 200 },
    { name: 'start', label: 'Start Date', width: 100 },
    { name: 'duration', label: 'Duration', width: 80 },
    { name: 'progress', label: 'Progress', width: 80 }
  ]

  // Custom task styling based on status
  const taskTemplate = (task: GanttTask) => {
    const job = jobs.find(j => j.title === task.text)
    const statusColor = job ? statusColors[job.status as keyof typeof statusColors] : '#6B7280'
    
    return {
      style: {
        backgroundColor: statusColor,
        border: `1px solid ${statusColor}`,
        borderRadius: '4px'
      }
    }
  }

  if (tasks.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Project Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-gray-500">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">No jobs to display</div>
              <div className="text-sm">Jobs will appear here when they are created</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${className} overflow-hidden`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Project Timeline</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {tasks.length} jobs displayed • Professional Gantt chart with drag & drop
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            {Object.entries(statusColors).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: color }}
                />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div style={{ height: '500px', width: '100%' }}>
          <Gantt
            tasks={tasks}
            links={links}
            scales={scales}
            columns={columns}
            taskTemplate={taskTemplate}
            readonly={false}
            taskHeight={32}
            scaleHeight={60}
            // Enable today line
            markers={[{
              id: 'today',
              css: 'today-line',
              start: new Date(),
              title: 'Today'
            }]}
          />
        </div>
      </CardContent>
      
      {/* Custom CSS for today line */}
      <style jsx global>{`
        .today-line {
          background-color: #EF4444 !important;
          width: 2px !important;
          z-index: 10 !important;
        }
        .wx-gantt-task-bar {
          opacity: 0.9 !important;
        }
        .wx-gantt-grid-row:hover {
          background-color: #f9fafb !important;
        }
      `}</style>
    </Card>
  )
}