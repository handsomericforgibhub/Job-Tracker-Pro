'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TimeClock from '@/components/time/time-clock'
import TimeEntryForm from '@/components/time/time-entry-form'
import TimesheetView from '@/components/time/timesheet-view'
import ApprovalDashboard from '@/components/time/approval-dashboard'
import { TimeClockStatus, Job, Task, Worker, TimeEntry } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'
import { 
  Clock, 
  Calendar, 
  PlusCircle, 
  CheckCircle, 
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

export default function TimePage() {
  const { user, company } = useAuthStore()
  const [jobs, setJobs] = useState<Job[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [currentWorker, setCurrentWorker] = useState<Worker | null>(null)
  const [timeClockStatus, setTimeClockStatus] = useState<TimeClockStatus | null>(null)
  const [showAddEntry, setShowAddEntry] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)
  const [activeTab, setActiveTab] = useState('clock')

  // Determine user type and permissions
  const isWorker = user?.role === 'worker'
  const isManager = user?.role === 'owner' || user?.role === 'foreman'

  useEffect(() => {
    if (company?.id) {
      fetchJobs()
      fetchTasks()
      fetchWorkers() // Always fetch workers for the dropdown
      if (isWorker) {
        fetchCurrentWorker()
      }
    }
  }, [company?.id, user?.id, isManager, isWorker])

  const fetchJobs = async () => {
    try {
      const response = await fetch('/api/jobs')
      if (response.ok) {
        const data = await response.json()
        setJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      const response = await fetch('/api/tasks')
      if (response.ok) {
        const data = await response.json()
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Error fetching tasks:', error)
    }
  }

  const fetchWorkers = async () => {
    try {
      console.log('Fetching workers...')
      const response = await fetch('/api/workers')
      console.log('Workers response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Workers data:', data)
        setWorkers(data.workers || [])
      } else {
        console.error('Workers fetch failed:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching workers:', error)
    }
  }

  const fetchCurrentWorker = async () => {
    try {
      // Assuming there's an endpoint to get worker profile by user_id
      const response = await fetch(`/api/workers?user_id=${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.workers && data.workers.length > 0) {
          setCurrentWorker(data.workers[0])
        }
      }
    } catch (error) {
      console.error('Error fetching current worker:', error)
    }
  }

  const handleTimeClockStatusChange = (status: TimeClockStatus) => {
    setTimeClockStatus(status)
  }

  const handleAddEntry = () => {
    setEditingEntry(null)
    setShowAddEntry(true)
  }

  const handleEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setShowAddEntry(true)
  }

  const handleSaveEntry = (entry: TimeEntry) => {
    setShowAddEntry(false)
    setEditingEntry(null)
    toast.success('Time entry saved successfully')
    // Refresh timesheet if on that tab
    if (activeTab === 'timesheet') {
      // The TimesheetView component will refresh automatically
    }
  }

  const handleCancelEntry = () => {
    setShowAddEntry(false)
    setEditingEntry(null)
  }

  // Quick stats for managers
  const quickStats = {
    activeWorkers: timeClockStatus ? 1 : 0, // This would come from API in real app
    totalHoursToday: timeClockStatus?.total_hours_today || 0,
    pendingApprovals: 0, // This would come from API
    laborCostToday: 0, // This would come from API
  }

  if (!user || !company) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Please log in to access time tracking</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Time Tracking</h1>
        <p className="text-gray-600">
          {isWorker ? 'Track your work time and view timesheets' : 'Manage worker time tracking and approvals'}
        </p>
      </div>

      {/* Quick Stats for Managers */}
      {isManager && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Workers</p>
                  <p className="text-2xl font-bold text-gray-900">{quickStats.activeWorkers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Hours Today</p>
                  <p className="text-2xl font-bold text-gray-900">{quickStats.totalHoursToday.toFixed(1)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                  <p className="text-2xl font-bold text-gray-900">{quickStats.pendingApprovals}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Labor Cost Today</p>
                  <p className="text-2xl font-bold text-gray-900">${quickStats.laborCostToday.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="clock" className="flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Time Clock</span>
          </TabsTrigger>
          <TabsTrigger value="timesheet" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Timesheet</span>
          </TabsTrigger>
          <TabsTrigger value="entries" className="flex items-center space-x-2">
            <PlusCircle className="h-4 w-4" />
            <span>Add Entry</span>
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="approvals" className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4" />
              <span>Approvals</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Time Clock Tab */}
        <TabsContent value="clock">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TimeClock
                worker={currentWorker || undefined}
                jobs={jobs}
                onStatusChange={handleTimeClockStatusChange}
              />
            </div>
            
            {/* Current Status Info */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Today's Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  {timeClockStatus ? (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <Badge variant={timeClockStatus.is_clocked_in ? "default" : "secondary"}>
                          {timeClockStatus.is_clocked_in ? 'Clocked In' : 'Clocked Out'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Regular Hours:</span>
                        <span className="font-medium">{timeClockStatus.total_hours_today.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Break Time:</span>
                        <span className="font-medium">{timeClockStatus.break_time_today.toFixed(1)}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Overtime:</span>
                        <span className="font-medium text-orange-600">{timeClockStatus.overtime_hours_today.toFixed(1)}h</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-600">No status information available</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('timesheet')}
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    View Timesheet
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => setActiveTab('entries')}
                  >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Add Time Entry
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Timesheet Tab */}
        <TabsContent value="timesheet">
          <TimesheetView
            worker={currentWorker || undefined}
            onEditEntry={handleEditEntry}
            onAddEntry={handleAddEntry}
          />
        </TabsContent>

        {/* Add/Edit Entry Tab */}
        <TabsContent value="entries">
          <div className="max-w-4xl mx-auto">
            <TimeEntryForm
              worker={currentWorker || undefined}
              workers={workers}
              jobs={jobs}
              tasks={tasks}
              existingEntry={editingEntry || undefined}
              onSave={handleSaveEntry}
              onCancel={() => setActiveTab('timesheet')}
            />
          </div>
        </TabsContent>

        {/* Approvals Tab (Managers Only) */}
        {isManager && (
          <TabsContent value="approvals">
            <ApprovalDashboard workers={workers} />
          </TabsContent>
        )}
      </Tabs>

      {/* Add Entry Modal */}
      {showAddEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
            <TimeEntryForm
              worker={currentWorker || undefined}
              workers={workers}
              jobs={jobs}
              tasks={tasks}
              existingEntry={editingEntry || undefined}
              onSave={handleSaveEntry}
              onCancel={handleCancelEntry}
            />
          </div>
        </div>
      )}
    </div>
  )
}