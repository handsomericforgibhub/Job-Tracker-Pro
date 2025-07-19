'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimeEntry, Worker, TimesheetData } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'
import { 
  Calendar, 
  Clock, 
  DollarSign, 
  Download, 
  Edit, 
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Filter,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'

interface TimesheetViewProps {
  worker?: Worker
  startDate?: string
  endDate?: string
  onEditEntry?: (entry: TimeEntry) => void
  onAddEntry?: () => void
  className?: string
}

export function TimesheetView({ 
  worker, 
  startDate, 
  endDate, 
  onEditEntry, 
  onAddEntry,
  className 
}: TimesheetViewProps) {
  const { user } = useAuthStore()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedWeek, setSelectedWeek] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [timesheetData, setTimesheetData] = useState<TimesheetData | null>(null)

  // Get current week dates
  const getCurrentWeek = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    }
  }

  // Initialize with current week if no dates provided
  useEffect(() => {
    if (!startDate || !endDate) {
      const currentWeek = getCurrentWeek()
      setSelectedWeek(`${currentWeek.start}_${currentWeek.end}`)
    } else {
      setSelectedWeek(`${startDate}_${endDate}`)
    }
  }, [startDate, endDate])

  // Fetch time entries when worker or dates change
  useEffect(() => {
    if (worker?.id && selectedWeek) {
      fetchTimeEntries()
    }
  }, [worker?.id, selectedWeek, filterStatus])

  const fetchTimeEntries = async () => {
    if (!worker?.id || !selectedWeek) return

    setIsLoading(true)
    
    try {
      const [start, end] = selectedWeek.split('_')
      const params = new URLSearchParams({
        worker_id: worker.id,
        start_date: start,
        end_date: end + 'T23:59:59Z',
      })

      if (filterStatus !== 'all') {
        params.append('status', filterStatus)
      }

      const response = await fetch(`/api/time/entries?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch time entries')
      }

      const data = await response.json()
      setTimeEntries(data.time_entries || [])
      
      // Calculate timesheet summary
      calculateTimesheetSummary(data.time_entries || [], start, end)

    } catch (error) {
      console.error('Error fetching time entries:', error)
      toast.error('Failed to fetch time entries')
    } finally {
      setIsLoading(false)
    }
  }

  const calculateTimesheetSummary = (entries: TimeEntry[], start: string, end: string) => {
    const summary = entries.reduce((acc, entry) => {
      const hours = (entry.duration_minutes || 0) / 60
      const breakHours = (entry.break_duration_minutes || 0) / 60
      const cost = entry.total_cost || 0

      if (entry.entry_type === 'overtime') {
        acc.total_overtime_hours += hours
      } else {
        acc.total_regular_hours += hours
      }
      acc.total_break_hours += breakHours
      acc.total_cost += cost

      return acc
    }, {
      total_regular_hours: 0,
      total_overtime_hours: 0,
      total_break_hours: 0,
      total_cost: 0
    })

    // Determine overall approval status
    const approvedCount = entries.filter(e => e.status === 'approved').length
    const rejectedCount = entries.filter(e => e.status === 'rejected').length
    const pendingCount = entries.filter(e => e.status === 'pending').length

    let approval_status: 'pending' | 'approved' | 'rejected' | 'partial'
    if (entries.length === 0) {
      approval_status = 'pending'
    } else if (approvedCount === entries.length) {
      approval_status = 'approved'
    } else if (rejectedCount > 0) {
      approval_status = 'rejected'
    } else if (approvedCount > 0) {
      approval_status = 'partial'
    } else {
      approval_status = 'pending'
    }

    setTimesheetData({
      period_start: start,
      period_end: end,
      time_entries: entries,
      ...summary,
      approval_status,
      worker: worker!,
    })
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry?')) {
      return
    }

    try {
      const response = await fetch(`/api/time/entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.id}`,
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete time entry')
      }

      toast.success('Time entry deleted successfully')
      fetchTimeEntries() // Refresh the list

    } catch (error) {
      console.error('Delete time entry error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete time entry')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}:${mins.toString().padStart(2, '0')}`
  }

  // Generate week options for the dropdown
  const getWeekOptions = () => {
    const options = []
    const today = new Date()
    
    // Generate options for 8 weeks (4 past, current, 3 future)
    for (let i = -4; i <= 3; i++) {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay() + 1 + (i * 7))
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)
      
      const startStr = weekStart.toISOString().split('T')[0]
      const endStr = weekEnd.toISOString().split('T')[0]
      const value = `${startStr}_${endStr}`
      
      const label = i === 0 ? 'This Week' : 
                   i === -1 ? 'Last Week' :
                   i === 1 ? 'Next Week' :
                   `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      
      options.push({ value, label })
    }
    
    return options
  }

  if (!worker) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Worker profile required for timesheet view</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Timesheet - {worker.first_name} {worker.last_name}</span>
            </CardTitle>
            {onAddEntry && (
              <Button onClick={onAddEntry}>
                <Plus className="h-4 w-4 mr-2" />
                Add Entry
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Week Selection and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="week-select">Time Period</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger>
                  <SelectValue placeholder="Select week" />
                </SelectTrigger>
                <SelectContent>
                  {getWeekOptions().map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">Status Filter</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {/* Timesheet Summary */}
          {timesheetData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-gray-600">Regular Hours</div>
                <div className="text-xl font-bold text-gray-900">
                  {timesheetData.total_regular_hours.toFixed(1)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Overtime Hours</div>
                <div className="text-xl font-bold text-orange-600">
                  {timesheetData.total_overtime_hours.toFixed(1)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Total Cost</div>
                <div className="text-xl font-bold text-green-600">
                  ${timesheetData.total_cost.toFixed(2)}
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Status</div>
                <Badge className={getStatusColor(timesheetData.approval_status)}>
                  {timesheetData.approval_status}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Entries List */}
      <Card>
        <CardHeader>
          <CardTitle>Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading time entries...</span>
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No time entries found for the selected period</p>
              {onAddEntry && (
                <Button onClick={onAddEntry} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Entry
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <div 
                  key={entry.id} 
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <div className="font-medium">
                          {formatDate(entry.start_time)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatTime(entry.start_time)} - {entry.end_time ? formatTime(entry.end_time) : 'In Progress'}
                        </div>
                        <div className="text-sm font-medium">
                          {entry.duration_minutes ? formatDuration(entry.duration_minutes) : '--:--'}
                        </div>
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(entry.status)}
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Job:</span>
                          <span className="ml-1 font-medium">{entry.job?.title || 'Unknown Job'}</span>
                        </div>
                        {entry.task && (
                          <div>
                            <span className="text-gray-600">Task:</span>
                            <span className="ml-1 font-medium">{entry.task.title}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-600">Type:</span>
                          <span className="ml-1 font-medium capitalize">{entry.entry_type}</span>
                        </div>
                      </div>

                      {entry.description && (
                        <div className="mt-2 text-sm text-gray-600">
                          {entry.description}
                        </div>
                      )}

                      {entry.total_cost && (
                        <div className="mt-2 text-sm">
                          <span className="text-gray-600">Cost:</span>
                          <span className="ml-1 font-medium text-green-600">
                            ${entry.total_cost.toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center space-x-2 ml-4">
                      {onEditEntry && entry.status !== 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditEntry(entry)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {entry.status !== 'approved' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Approval Information */}
                  {entry.approved_by_user && (
                    <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                      {entry.status === 'approved' ? 'Approved' : 'Reviewed'} by {entry.approved_by_user.full_name}
                      {entry.approved_at && ` on ${formatDate(entry.approved_at)}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default TimesheetView