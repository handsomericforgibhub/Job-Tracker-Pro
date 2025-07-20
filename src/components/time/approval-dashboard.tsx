'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { SelectWithValue } from '@/components/ui/select-with-value'
import { Checkbox } from '@/components/ui/checkbox'
import { TimeEntry, TimeApproval, Worker } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  MessageSquare,
  Filter,
  Calendar,
  User,
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react'
import { toast } from 'sonner'
import TimesheetApproval from './timesheet-approval'

interface ApprovalDashboardProps {
  workers?: Worker[]
  className?: string
}

export function ApprovalDashboard({ workers = [], className }: ApprovalDashboardProps) {
  const { user } = useAuthStore()
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [filters, setFilters] = useState({
    status: 'pending',
    worker_id: '',
    start_date: '',
    end_date: '',
  })
  const [approvalModal, setApprovalModal] = useState<{
    entry: TimeEntry | null
    action: 'approve' | 'reject' | 'request_changes' | null
  }>({
    entry: null,
    action: null
  })
  const [approvalNotes, setApprovalNotes] = useState('')
  const [requestedChanges, setRequestedChanges] = useState('')
  const [selectedEntryForApproval, setSelectedEntryForApproval] = useState<TimeEntry | null>(null)

  // Fetch pending time entries
  useEffect(() => {
    fetchTimeEntries()
  }, [filters])

  const fetchTimeEntries = async () => {
    setIsLoading(true)
    
    try {
      const params = new URLSearchParams()
      
      // Only fetch entries that need approval
      if (filters.status) params.append('status', filters.status)
      if (filters.worker_id) params.append('worker_id', filters.worker_id)
      if (filters.start_date) params.append('start_date', filters.start_date)
      if (filters.end_date) params.append('end_date', filters.end_date)
      
      // Default to showing pending entries
      if (!filters.status || filters.status === 'pending') {
        params.set('status', 'pending')
      }

      const response = await fetch(`/api/time/entries?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch time entries')
      }

      const data = await response.json()
      setTimeEntries(data.time_entries || [])

    } catch (error) {
      console.error('Error fetching time entries:', error)
      toast.error('Failed to fetch time entries for approval')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSingleApproval = async (entryId: string, action: 'approve' | 'reject' | 'request_changes') => {
    const entry = timeEntries.find(e => e.id === entryId)
    if (!entry) return

    setApprovalModal({ entry, action })
  }

  const submitApproval = async () => {
    if (!approvalModal.entry || !approvalModal.action) return

    try {
      const approvalData = {
        time_entry_id: approvalModal.entry.id,
        approval_status: approvalModal.action === 'approve' ? 'approved' : 
                        approvalModal.action === 'reject' ? 'rejected' : 'changes_requested',
        approver_notes: approvalNotes || undefined,
        requested_changes: requestedChanges || undefined,
      }

      const response = await fetch('/api/time/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`,
        },
        body: JSON.stringify(approvalData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process approval')
      }

      const data = await response.json()
      toast.success(`Time entry ${approvalModal.action}d successfully`)
      
      // Close modal and refresh
      setApprovalModal({ entry: null, action: null })
      setApprovalNotes('')
      setRequestedChanges('')
      fetchTimeEntries()

    } catch (error) {
      console.error('Approval error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process approval')
    }
  }

  const handleBulkApproval = async (action: 'approve' | 'reject') => {
    if (selectedEntries.size === 0) {
      toast.error('Please select entries to process')
      return
    }

    setIsBulkProcessing(true)

    try {
      const bulkData = {
        time_entry_ids: Array.from(selectedEntries),
        approval_status: action === 'approve' ? 'approved' : 'rejected',
        approver_notes: approvalNotes || undefined,
      }

      const response = await fetch('/api/time/approvals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`,
        },
        body: JSON.stringify(bulkData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to process bulk approval')
      }

      const data = await response.json()
      toast.success(`Bulk ${action}al completed: ${data.successful?.length || 0} processed, ${data.failed?.length || 0} failed`)
      
      // Clear selections and refresh
      setSelectedEntries(new Set())
      setApprovalNotes('')
      fetchTimeEntries()

    } catch (error) {
      console.error('Bulk approval error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to process bulk approval')
    } finally {
      setIsBulkProcessing(false)
    }
  }

  const toggleEntrySelection = (entryId: string) => {
    const newSelection = new Set(selectedEntries)
    if (newSelection.has(entryId)) {
      newSelection.delete(entryId)
    } else {
      newSelection.add(entryId)
    }
    setSelectedEntries(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedEntries.size === timeEntries.length) {
      setSelectedEntries(new Set())
    } else {
      setSelectedEntries(new Set(timeEntries.map(e => e.id)))
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

  const totalSelectedCost = timeEntries
    .filter(entry => selectedEntries.has(entry.id))
    .reduce((sum, entry) => sum + (entry.total_cost || 0), 0)

  const totalSelectedHours = timeEntries
    .filter(entry => selectedEntries.has(entry.id))
    .reduce((sum, entry) => sum + ((entry.duration_minutes || 0) / 60), 0)

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5" />
            <span>Time Entry Approvals</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="status-filter">Status</Label>
              <SelectWithValue
                value={filters.status}
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
                placeholder="Select status..."
                options={[
                  { value: "pending", label: "Pending" },
                  { value: "approved", label: "Approved" },
                  { value: "rejected", label: "Rejected" },
                  { value: "all", label: "All Statuses" }
                ]}
              />
            </div>

            <div>
              <Label htmlFor="worker-filter">Worker</Label>
              <SelectWithValue
                value={filters.worker_id} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, worker_id: value }))}
                placeholder="All workers"
                options={[
                  { value: "", label: "All Workers" },
                  ...workers.map((worker) => ({
                    value: worker.id,
                    label: `${worker.first_name} ${worker.last_name}`
                  }))
                ]}
              />
            </div>

            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Bulk Actions */}
          {timeEntries.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="flex items-center"
                  >
                    {selectedEntries.size === timeEntries.length ? 
                      <CheckSquare className="h-4 w-4" /> : 
                      <Square className="h-4 w-4" />
                    }
                  </button>
                  <span className="text-sm">
                    {selectedEntries.size} of {timeEntries.length} selected
                  </span>
                </div>

                {selectedEntries.size > 0 && (
                  <div className="text-sm text-gray-600">
                    Total: {totalSelectedHours.toFixed(1)}h • ${totalSelectedCost.toFixed(2)}
                  </div>
                )}
              </div>

              {selectedEntries.size > 0 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkApproval('approve')}
                    disabled={isBulkProcessing}
                  >
                    {isBulkProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Bulk Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkApproval('reject')}
                    disabled={isBulkProcessing}
                  >
                    {isBulkProcessing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <XCircle className="h-4 w-4 mr-1" />
                    Bulk Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Entries List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Time Entries Awaiting Approval ({timeEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading time entries...</span>
            </div>
          ) : timeEntries.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No time entries found for approval</p>
            </div>
          ) : (
            <div className="space-y-3">
              {timeEntries.map((entry) => (
                <div 
                  key={entry.id} 
                  className={`border rounded-lg p-4 transition-all ${
                    selectedEntries.has(entry.id) ? 'bg-blue-50 border-blue-200' : 'hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    {/* Selection Checkbox */}
                    <div className="flex items-center pt-1">
                      <button
                        type="button"
                        onClick={() => toggleEntrySelection(entry.id)}
                        className="flex items-center"
                      >
                        {selectedEntries.has(entry.id) ? 
                          <CheckSquare className="h-4 w-4 text-blue-600" /> : 
                          <Square className="h-4 w-4" />
                        }
                      </button>
                    </div>

                    {/* Entry Details */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="font-medium">
                            {entry.worker?.first_name} {entry.worker?.last_name}
                          </div>
                          <Badge variant="secondary">
                            {entry.worker?.employee_id || 'No ID'}
                          </Badge>
                          <Badge className={getStatusColor(entry.status)}>
                            {entry.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDate(entry.start_time)}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-600">Time:</span>
                          <div className="font-medium">
                            {formatTime(entry.start_time)} - {entry.end_time ? formatTime(entry.end_time) : 'In Progress'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {entry.duration_minutes ? formatDuration(entry.duration_minutes) : '--:--'}
                          </div>
                        </div>

                        <div>
                          <span className="text-gray-600">Job:</span>
                          <div className="font-medium">{entry.job?.title || 'Unknown Job'}</div>
                          {entry.task && (
                            <div className="text-xs text-gray-500">{entry.task.title}</div>
                          )}
                        </div>

                        <div>
                          <span className="text-gray-600">Type:</span>
                          <div className="font-medium capitalize">{entry.entry_type}</div>
                          {entry.entry_type === 'overtime' && (
                            <div className="text-xs text-orange-600">1.5x rate</div>
                          )}
                        </div>

                        <div>
                          <span className="text-gray-600">Cost:</span>
                          <div className="font-medium text-green-600">
                            ${entry.total_cost?.toFixed(2) || '0.00'}
                          </div>
                          <div className="text-xs text-gray-500">
                            ${entry.hourly_rate?.toFixed(2) || '0'}/hr
                          </div>
                        </div>
                      </div>

                      {entry.description && (
                        <div className="text-sm text-gray-600 mb-3">
                          <span className="font-medium">Notes:</span> {entry.description}
                        </div>
                      )}

                      {(entry.start_location || entry.end_location) && (
                        <div className="text-xs text-gray-500 mb-3">
                          {entry.start_location && (
                            <div>Start: {entry.start_location}</div>
                          )}
                          {entry.end_location && (
                            <div>End: {entry.end_location}</div>
                          )}
                        </div>
                      )}

                      {/* Individual Actions */}
                      {entry.status === 'pending' && (
                        <div className="flex items-center space-x-2 pt-3 border-t">
                          <Button
                            size="sm"
                            onClick={() => handleSingleApproval(entry.id, 'approve')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSingleApproval(entry.id, 'reject')}
                            className="text-red-600 border-red-600 hover:bg-red-50"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSingleApproval(entry.id, 'request_changes')}
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Request Changes
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Modal */}
      {approvalModal.entry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg bg-white border border-gray-200 shadow-xl">
            <CardHeader className="bg-white">
              <CardTitle className="text-gray-900">
                {approvalModal.action === 'approve' ? 'Approve' : 
                 approvalModal.action === 'reject' ? 'Reject' : 'Request Changes'} Time Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 bg-white">
              <div className="text-sm text-gray-700 space-y-1">
                <div><strong className="text-gray-900">Worker:</strong> {approvalModal.entry.worker?.first_name} {approvalModal.entry.worker?.last_name}</div>
                <div><strong className="text-gray-900">Date:</strong> {formatDate(approvalModal.entry.start_time)}</div>
                <div><strong className="text-gray-900">Duration:</strong> {approvalModal.entry.duration_minutes ? formatDuration(approvalModal.entry.duration_minutes) : '--:--'}</div>
                <div><strong className="text-gray-900">Cost:</strong> ${approvalModal.entry.total_cost?.toFixed(2) || '0.00'}</div>
              </div>

              <div>
                <Label htmlFor="approval-notes" className="text-gray-900">Approval Notes</Label>
                <Textarea
                  id="approval-notes"
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add notes about this approval decision..."
                  rows={3}
                  className="bg-white text-gray-900 border-gray-300"
                />
              </div>

              {approvalModal.action === 'request_changes' && (
                <div>
                  <Label htmlFor="requested-changes" className="text-gray-900">Requested Changes *</Label>
                  <Textarea
                    id="requested-changes"
                    value={requestedChanges}
                    onChange={(e) => setRequestedChanges(e.target.value)}
                    placeholder="Describe what changes are needed..."
                    rows={3}
                    required
                    className="bg-white text-gray-900 border-gray-300"
                  />
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setApprovalModal({ entry: null, action: null })
                    setApprovalNotes('')
                    setRequestedChanges('')
                  }}
                  className="flex-1 bg-white text-gray-900 border-gray-300 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitApproval}
                  disabled={approvalModal.action === 'request_changes' && !requestedChanges.trim()}
                  className={`flex-1 text-white ${
                    approvalModal.action === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                    approvalModal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                    'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {approvalModal.action === 'approve' ? 'Approve' : 
                   approvalModal.action === 'reject' ? 'Reject' : 'Request Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default ApprovalDashboard