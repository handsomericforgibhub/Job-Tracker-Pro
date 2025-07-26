'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { TimeEntry, Worker, Job } from '@/lib/types'
import SignatureCapture from '@/components/shared/signature/signature-capture'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User,
  Calendar,
  DollarSign,
  AlertTriangle,
  FileText,
  PenTool
} from 'lucide-react'
import { toast } from 'sonner'

interface TimesheetApprovalProps {
  timeEntry: TimeEntry
  onApproval: (data: {
    entryId: string
    status: 'approved' | 'rejected' | 'changes_requested'
    notes?: string
    signature?: string
    approvalDate: string
  }) => void
  onCancel: () => void
  className?: string
}

export function TimesheetApproval({
  timeEntry,
  onApproval,
  onCancel,
  className = ""
}: TimesheetApprovalProps) {
  const [approvalStatus, setApprovalStatus] = useState<'approved' | 'rejected' | 'changes_requested'>('approved')
  const [notes, setNotes] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const calculatePay = () => {
    if (!timeEntry.hourly_rate || !timeEntry.duration_minutes) return 0
    const hours = timeEntry.duration_minutes / 60
    const breakHours = (timeEntry.break_duration_minutes || 0) / 60
    const workHours = hours - breakHours
    
    if (timeEntry.entry_type === 'overtime' && timeEntry.overtime_rate) {
      return workHours * timeEntry.overtime_rate
    }
    return workHours * timeEntry.hourly_rate
  }

  const handleSignatureCapture = (signatureData: string) => {
    setSignature(signatureData)
  }

  const handleSubmitApproval = async () => {
    if (!signature) {
      toast.error('Digital signature is required for approval')
      return
    }

    if (approvalStatus === 'rejected' && !notes.trim()) {
      toast.error('Please provide a reason for rejection')
      return
    }

    if (approvalStatus === 'changes_requested' && !notes.trim()) {
      toast.error('Please specify what changes are needed')
      return
    }

    setIsSubmitting(true)

    try {
      await onApproval({
        entryId: timeEntry.id,
        status: approvalStatus,
        notes: notes.trim() || undefined,
        signature,
        approvalDate: new Date().toISOString()
      })

      toast.success(`Timesheet ${approvalStatus === 'approved' ? 'approved' : approvalStatus === 'rejected' ? 'rejected' : 'marked for changes'} successfully!`)
    } catch (error) {
      console.error('Approval error:', error)
      toast.error('Failed to process approval')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Timesheet Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timesheet Review
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Worker & Job Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Worker</Label>
              <div className="flex items-center gap-2 mt-1">
                <User className="h-4 w-4 text-gray-500" />
                <span className="font-medium">
                  {timeEntry.worker?.first_name} {timeEntry.worker?.last_name}
                </span>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-600">Job</Label>
              <div className="flex items-center gap-2 mt-1">
                <FileText className="h-4 w-4 text-gray-500" />
                <span className="font-medium">{timeEntry.job?.title}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Time Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Start Time</Label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{formatDate(timeEntry.start_time)}</span>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-600">End Time</Label>
              <div className="flex items-center gap-2 mt-1">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{timeEntry.end_time ? formatDate(timeEntry.end_time) : 'In Progress'}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Total Duration</Label>
              <div className="text-lg font-semibold text-blue-600">
                {formatDuration(timeEntry.duration_minutes || 0)}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-600">Break Time</Label>
              <div className="text-lg font-semibold text-orange-600">
                {formatDuration(timeEntry.break_duration_minutes || 0)}
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-600">Net Work Time</Label>
              <div className="text-lg font-semibold text-green-600">
                {formatDuration((timeEntry.duration_minutes || 0) - (timeEntry.break_duration_minutes || 0))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-600">Hourly Rate</Label>
              <div className="flex items-center gap-2 mt-1">
                <DollarSign className="h-4 w-4 text-gray-500" />
                <span className="font-medium">${timeEntry.hourly_rate || 0}/hr</span>
              </div>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-600">Entry Type</Label>
              <Badge variant={timeEntry.entry_type === 'overtime' ? 'destructive' : 'secondary'}>
                {timeEntry.entry_type}
              </Badge>
            </div>
            
            <div>
              <Label className="text-sm font-medium text-gray-600">Total Pay</Label>
              <div className="text-lg font-semibold text-green-600">
                ${calculatePay().toFixed(2)}
              </div>
            </div>
          </div>

          {/* Work Description */}
          {timeEntry.description && (
            <div>
              <Label className="text-sm font-medium text-gray-600">Work Description</Label>
              <div className="mt-1 p-3 bg-gray-50 rounded border">
                <p className="text-sm">{timeEntry.description}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval Decision */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Approval Decision
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Selection */}
          <div>
            <Label className="text-sm font-medium text-gray-700 mb-3 block">
              Select Approval Status:
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Button
                variant={approvalStatus === 'approved' ? 'default' : 'outline'}
                className={approvalStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                onClick={() => setApprovalStatus('approved')}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              
              <Button
                variant={approvalStatus === 'changes_requested' ? 'default' : 'outline'}
                className={approvalStatus === 'changes_requested' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                onClick={() => setApprovalStatus('changes_requested')}
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
              
              <Button
                variant={approvalStatus === 'rejected' ? 'default' : 'outline'}
                className={approvalStatus === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
                onClick={() => setApprovalStatus('rejected')}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="approval-notes" className="text-sm font-medium text-gray-700">
              {approvalStatus === 'approved' ? 'Approval Notes (Optional)' : 
               approvalStatus === 'rejected' ? 'Rejection Reason (Required)' : 
               'Changes Requested (Required)'}
            </Label>
            <Textarea
              id="approval-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                approvalStatus === 'approved' 
                  ? 'Add any notes about this approval...'
                  : approvalStatus === 'rejected'
                  ? 'Please explain why this timesheet is being rejected...'
                  : 'Please specify what changes are needed...'
              }
              rows={3}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Digital Signature */}
      <SignatureCapture
        title="Manager Approval Signature"
        description="Your digital signature confirms the approval of this timesheet"
        required={true}
        onSignatureCapture={handleSignatureCapture}
        width={400}
        height={150}
      />

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button
          onClick={onCancel}
          variant="outline"
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        
        <Button
          onClick={handleSubmitApproval}
          disabled={isSubmitting || !signature}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Processing...
            </>
          ) : (
            <>
              <PenTool className="h-4 w-4 mr-2" />
              Submit {approvalStatus === 'approved' ? 'Approval' : approvalStatus === 'rejected' ? 'Rejection' : 'Change Request'}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

export default TimesheetApproval