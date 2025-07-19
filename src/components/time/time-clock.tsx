'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TimeClockStatus, Worker, Job, LocationData } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'
import { 
  Clock, 
  Play, 
  Square, 
  MapPin, 
  Calendar,
  Timer,
  DollarSign,
  Coffee,
  CheckCircle,
  AlertCircle,
  Loader2,
  Shield,
  ShieldAlert,
  Navigation
} from 'lucide-react'
import { toast } from 'sonner'

interface TimeClockProps {
  worker?: Worker
  jobs: Job[]
  onStatusChange?: (status: TimeClockStatus) => void
  className?: string
}

export function TimeClock({ worker, jobs, onStatusChange, className }: TimeClockProps) {
  const { user, company } = useAuthStore()
  const [status, setStatus] = useState<TimeClockStatus>({
    is_clocked_in: false,
    total_hours_today: 0,
    break_time_today: 0,
    overtime_hours_today: 0,
  })
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [location, setLocation] = useState<LocationData | null>(null)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [locationVerification, setLocationVerification] = useState<{
    isVerified: boolean
    distance?: number
    warning?: string
  } | null>(null)

  // Current worker - use prop or authenticated user's worker profile
  const currentWorker = worker || (user?.role === 'worker' ? user as any : null)

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch current status on component mount
  useEffect(() => {
    if (currentWorker?.id) {
      fetchCurrentStatus()
    }
  }, [currentWorker?.id])

  // Get current location
  useEffect(() => {
    getCurrentLocation()
  }, [])

  // Re-verify location when job selection changes
  useEffect(() => {
    if (location && selectedJobId) {
      verifyLocationAgainstJob(location, selectedJobId)
    }
  }, [selectedJobId])

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported')
      setLocationVerification({
        isVerified: false,
        warning: 'GPS not supported on this device'
      })
      return
    }

    setIsGettingLocation(true)
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000, // Increased timeout
          maximumAge: 60000 // Reduced cache time for more accurate location
        })
      })

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
        speed: position.coords.speed,
        heading: position.coords.heading
      }

      // Verify GPS accuracy
      const accuracyWarning = validateGPSAccuracy(position.coords.accuracy)
      
      // Try to get address from coordinates
      try {
        const response = await fetch(
          `https://api.openstreetmap.org/reverse?format=json&lat=${locationData.latitude}&lon=${locationData.longitude}&zoom=18&addressdetails=1`
        )
        const data = await response.json()
        if (data.display_name) {
          locationData.address = data.display_name
        }
      } catch (addressError) {
        console.warn('Could not fetch address:', addressError)
      }

      setLocation(locationData)
      
      // Verify location against selected job if available
      if (selectedJobId) {
        await verifyLocationAgainstJob(locationData, selectedJobId)
      } else {
        setLocationVerification({
          isVerified: true,
          warning: accuracyWarning
        })
      }
      
    } catch (error) {
      console.warn('Could not get location:', error)
      setLocationVerification({
        isVerified: false,
        warning: 'Unable to access GPS location. Please enable location services.'
      })
      toast.warning('Location access denied. GPS verification will be skipped.')
    } finally {
      setIsGettingLocation(false)
    }
  }

  const fetchCurrentStatus = async () => {
    if (!currentWorker?.id) return

    try {
      const response = await fetch(`/api/time/check-in?worker_id=${currentWorker.id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch status')
      }

      const data = await response.json()
      const newStatus: TimeClockStatus = {
        is_clocked_in: data.is_clocked_in,
        current_check_in: data.current_check_in,
        current_time_entry: data.current_time_entry,
        active_break: data.current_time_entry?.break_entries?.find((b: any) => !b.end_time),
        total_hours_today: data.daily_stats?.regular_hours || 0,
        break_time_today: data.daily_stats?.break_hours || 0,
        overtime_hours_today: data.daily_stats?.overtime_hours || 0,
      }

      setStatus(newStatus)
      onStatusChange?.(newStatus)

      // Set selected job if currently checked in
      if (newStatus.current_check_in) {
        setSelectedJobId(newStatus.current_check_in.job_id)
      }

    } catch (error) {
      console.error('Error fetching status:', error)
      toast.error('Failed to fetch current status')
    }
  }

  const handleCheckIn = async () => {
    if (!currentWorker?.id || !selectedJobId) {
      toast.error('Please select a job before checking in')
      return
    }

    setIsLoading(true)

    try {
      const checkInData = {
        worker_id: currentWorker.id,
        job_id: selectedJobId,
        location: location?.address || 'Location unavailable',
        gps_lat: location?.latitude,
        gps_lng: location?.longitude,
        gps_accuracy: location?.accuracy,
        gps_speed: location?.speed,
        gps_heading: location?.heading,
        location_verified: locationVerification?.isVerified || false,
        verification_distance: locationVerification?.distance,
        notes: notes.trim() || undefined,
      }

      const response = await fetch('/api/time/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`, // Replace with proper auth token
        },
        body: JSON.stringify(checkInData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Check-in failed')
      }

      const data = await response.json()
      toast.success('Successfully checked in!')
      
      // Reset form
      setNotes('')
      
      // Refresh status
      await fetchCurrentStatus()

    } catch (error) {
      console.error('Check-in error:', error)
      toast.error(error instanceof Error ? error.message : 'Check-in failed')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!currentWorker?.id || !status.current_check_in) {
      toast.error('No active check-in found')
      return
    }

    setIsLoading(true)

    try {
      const checkOutData = {
        worker_id: currentWorker.id,
        check_in_id: status.current_check_in.id,
        location: location?.address || 'Location unavailable',
        gps_lat: location?.latitude,
        gps_lng: location?.longitude,
        gps_accuracy: location?.accuracy,
        gps_speed: location?.speed,
        gps_heading: location?.heading,
        location_verified: locationVerification?.isVerified || false,
        verification_distance: locationVerification?.distance,
        notes: notes.trim() || undefined,
      }

      const response = await fetch('/api/time/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.id}`, // Replace with proper auth token
        },
        body: JSON.stringify(checkOutData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Check-out failed')
      }

      const data = await response.json()
      toast.success(`Successfully checked out! Total time: ${Math.round(data.total_minutes / 60 * 100) / 100} hours`)
      
      // Reset form
      setNotes('')
      setSelectedJobId('')
      
      // Refresh status
      await fetchCurrentStatus()

    } catch (error) {
      console.error('Check-out error:', error)
      toast.error(error instanceof Error ? error.message : 'Check-out failed')
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const validateGPSAccuracy = (accuracy: number | null): string | undefined => {
    if (!accuracy) return 'GPS accuracy unknown'
    if (accuracy > 50) return 'GPS accuracy is low (±' + Math.round(accuracy) + 'm)'
    if (accuracy > 20) return 'GPS accuracy is moderate (±' + Math.round(accuracy) + 'm)'
    return undefined // Good accuracy
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c // Distance in meters
  }

  const verifyLocationAgainstJob = async (locationData: LocationData, jobId: string) => {
    try {
      const job = jobs.find(j => j.id === jobId)
      if (!job || !job.latitude || !job.longitude) {
        setLocationVerification({
          isVerified: true,
          warning: 'Job location not available for verification'
        })
        return
      }

      const distance = calculateDistance(
        locationData.latitude,
        locationData.longitude,
        job.latitude,
        job.longitude
      )

      const accuracyWarning = validateGPSAccuracy(locationData.accuracy)
      let verification = { isVerified: true, distance, warning: accuracyWarning }
      
      if (distance > 200) { // More than 200m from job site
        verification = {
          isVerified: false,
          distance,
          warning: `You are ${Math.round(distance)}m away from the job site. Please move closer.`
        }
      } else if (distance > 100) { // Within 200m but not very close
        verification = {
          isVerified: true,
          distance,
          warning: `You are ${Math.round(distance)}m from the job site.`
        }
      }

      setLocationVerification(verification)
    } catch (error) {
      console.error('Location verification error:', error)
      setLocationVerification({
        isVerified: true,
        warning: 'Unable to verify location against job site'
      })
    }
  }

  const getWorkingTime = () => {
    if (!status.current_check_in) return '00:00:00'
    
    const checkInTime = new Date(status.current_check_in.check_in_time)
    const now = new Date()
    const diffMs = now.getTime() - checkInTime.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000)
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  if (!currentWorker) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Worker profile required for time tracking</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Current Time and Status */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Time Clock</span>
            </CardTitle>
            <Badge 
              variant={status.is_clocked_in ? "default" : "secondary"}
              className={status.is_clocked_in ? "bg-green-500" : ""}
            >
              {status.is_clocked_in ? 'CLOCKED IN' : 'CLOCKED OUT'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Time Display */}
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-gray-900">
              {formatTime(currentTime)}
            </div>
            <div className="text-sm text-gray-600">
              {formatDate(currentTime)}
            </div>
          </div>

          {/* Working Time */}
          {status.is_clocked_in && (
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600 font-medium">Current Session</div>
              <div className="text-2xl font-mono font-bold text-blue-900">
                {getWorkingTime()}
              </div>
              {status.current_check_in && (
                <div className="text-xs text-blue-600 mt-1">
                  Started at {new Date(status.current_check_in.check_in_time).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}

          {/* Daily Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Regular</div>
              <div className="text-lg font-bold text-gray-900">
                {status.total_hours_today.toFixed(1)}h
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Breaks</div>
              <div className="text-lg font-bold text-gray-900">
                {status.break_time_today.toFixed(1)}h
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-medium text-gray-600">Overtime</div>
              <div className="text-lg font-bold text-orange-600">
                {status.overtime_hours_today.toFixed(1)}h
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Location Status */}
      {(location || locationVerification) && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              {location && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm">
                    <MapPin className={`h-4 w-4 ${
                      locationVerification?.isVerified ? 'text-green-600' : 'text-orange-600'
                    }`} />
                    <span className={locationVerification?.isVerified ? 'text-green-600' : 'text-orange-600'}>
                      {locationVerification?.isVerified ? 'Location verified' : 'Location warning'}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {location.accuracy ? `±${Math.round(location.accuracy)}m` : 'GPS'}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-1">
                    {locationVerification?.isVerified ? (
                      <Shield className="h-4 w-4 text-green-600" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-orange-600" />
                    )}
                  </div>
                </div>
              )}
              
              {locationVerification?.warning && (
                <div className={`text-xs p-2 rounded ${
                  locationVerification.isVerified 
                    ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {locationVerification.warning}
                </div>
              )}
              
              {location?.address && (
                <p className="text-xs text-gray-500 truncate">
                  📍 {location.address}
                </p>
              )}
              
              {locationVerification?.distance !== undefined && (
                <div className="text-xs text-gray-600">
                  📏 Distance to job site: {Math.round(locationVerification.distance)}m
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check-in/Check-out Form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {status.is_clocked_in ? 'Check Out' : 'Check In'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Job Selection (only for check-in) */}
          {!status.is_clocked_in && (
            <div>
              <Label htmlFor="job-select">Select Job *</Label>
              <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a job to work on" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      <div>
                        <div className="font-medium">{job.title}</div>
                        <div className="text-xs text-gray-500">{job.client_name}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Current Job Display (for check-out) */}
          {status.is_clocked_in && status.current_check_in && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-600">Current Job</div>
              <div className="font-medium">
                {status.current_check_in.job?.title || 'Unknown Job'}
              </div>
              {status.current_check_in.job?.client_name && (
                <div className="text-sm text-gray-600">
                  {status.current_check_in.job.client_name}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={status.is_clocked_in ? 
                "Add any notes about your work or issues encountered..." : 
                "Add any notes about the start of your work..."}
              rows={3}
            />
          </div>

          {/* Location Verification Warning */}
          {!status.is_clocked_in && locationVerification && !locationVerification.isVerified && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 text-orange-700">
                <ShieldAlert className="h-4 w-4" />
                <span className="text-sm font-medium">Location Verification Warning</span>
              </div>
              <p className="text-xs text-orange-600 mt-1">
                Your location could not be verified against the job site. Check-in will proceed but may require manager approval.
              </p>
            </div>
          )}

          {/* Action Button */}
          <Button
            onClick={status.is_clocked_in ? handleCheckOut : handleCheckIn}
            disabled={isLoading || (!status.is_clocked_in && !selectedJobId)}
            className={`w-full ${status.is_clocked_in ? 
              'bg-red-600 hover:bg-red-700' : 
              'bg-green-600 hover:bg-green-700'}`}
            size="lg"
          >
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {status.is_clocked_in ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Check Out
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Check In
              </>
            )}
          </Button>

          {/* Location Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={getCurrentLocation}
            disabled={isGettingLocation}
            className="w-full"
          >
            {isGettingLocation && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Navigation className="h-4 w-4 mr-2" />
            {isGettingLocation ? 'Verifying Location...' : 'Refresh & Verify Location'}
          </Button>
        </CardContent>
      </Card>

      {/* Break Controls */}
      {status.is_clocked_in && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Coffee className="h-5 w-5" />
              <span>Break Time</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.active_break ? (
              <div className="space-y-3">
                <div className="p-3 bg-orange-50 rounded-lg">
                  <div className="text-sm font-medium text-orange-600">
                    On Break - {status.active_break.break_type}
                  </div>
                  <div className="text-xs text-orange-600">
                    Started at {new Date(status.active_break.start_time).toLocaleTimeString()}
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    // TODO: Implement end break functionality
                    toast.info('End break functionality coming soon!')
                  }}
                >
                  End Break
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // TODO: Implement start break functionality
                  toast.info('Start break functionality coming soon!')
                }}
              >
                <Coffee className="h-4 w-4 mr-2" />
                Start Break
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default TimeClock