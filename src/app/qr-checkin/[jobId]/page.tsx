'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Job, Worker, LocationData } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'
import { EXTERNAL_APIS } from '@/config/endpoints'
import { TIMEOUTS } from '@/config/timeouts'
import { 
  MapPin, 
  Building2, 
  Clock, 
  QrCode,
  CheckCircle,
  AlertCircle,
  Loader2,
  Navigation,
  Shield,
  ShieldAlert,
  UserCheck,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

export default function QRCheckInPage() {
  const params = useParams()
  const router = useRouter()
  const { user, company } = useAuthStore()
  const jobId = params.jobId as string

  const [job, setJob] = useState<Job | null>(null)
  const [worker, setWorker] = useState<Worker | null>(null)
  const [location, setLocation] = useState<LocationData | null>(null)
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingIn, setIsCheckingIn] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationVerification, setLocationVerification] = useState<{
    isVerified: boolean
    distance?: number
    warning?: string
  } | null>(null)
  const [checkInSuccess, setCheckInSuccess] = useState(false)

  useEffect(() => {
    fetchJobDetails()
    getCurrentLocation()
    if (user?.role === 'worker') {
      fetchWorkerProfile()
    }
  }, [jobId, user])

  const fetchJobDetails = async () => {
    try {
      const response = await fetch(`/api/jobs/${jobId}`)
      if (response.ok) {
        const data = await response.json()
        setJob(data.job)
      } else {
        toast.error('Job not found')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error fetching job:', error)
      toast.error('Failed to load job details')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchWorkerProfile = async () => {
    try {
      const response = await fetch(`/api/workers?user_id=${user?.id}`)
      if (response.ok) {
        const data = await response.json()
        if (data.workers && data.workers.length > 0) {
          setWorker(data.workers[0])
        }
      }
    } catch (error) {
      console.error('Error fetching worker profile:', error)
    }
  }

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
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
          timeout: 15000,
          maximumAge: 60000
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

      // Get address from coordinates
      try {
        const response = await fetch(
          EXTERNAL_APIS.OPENSTREETMAP.getReverseGeocodingUrl(locationData.latitude, locationData.longitude)
        )
        const data = await response.json()
        if (data.display_name) {
          locationData.address = data.display_name
        }
      } catch (addressError) {
        console.warn('Could not fetch address:', addressError)
      }

      setLocation(locationData)
      
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

  const verifyLocationAgainstJob = () => {
    if (!location || !job || !job.latitude || !job.longitude) {
      setLocationVerification({
        isVerified: true,
        warning: 'Job location not available for verification'
      })
      return
    }

    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      job.latitude,
      job.longitude
    )

    const accuracyWarning = validateGPSAccuracy(location.accuracy)
    let verification = { isVerified: true, distance, warning: accuracyWarning }
    
    if (distance > 200) {
      verification = {
        isVerified: false,
        distance,
        warning: `You are ${Math.round(distance)}m away from the job site. Please move closer.`
      }
    } else if (distance > 100) {
      verification = {
        isVerified: true,
        distance,
        warning: `You are ${Math.round(distance)}m from the job site.`
      }
    }

    setLocationVerification(verification)
  }

  const validateGPSAccuracy = (accuracy: number | null): string | undefined => {
    if (!accuracy) return 'GPS accuracy unknown'
    if (accuracy > 50) return 'GPS accuracy is low (±' + Math.round(accuracy) + 'm)'
    if (accuracy > 20) return 'GPS accuracy is moderate (±' + Math.round(accuracy) + 'm)'
    return undefined
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000 // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }

  const handleCheckIn = async () => {
    if (!user || !worker || !job) {
      toast.error('Authentication required for check-in')
      router.push('/auth/login')
      return
    }

    setIsCheckingIn(true)

    try {
      const checkInData = {
        worker_id: worker.id,
        job_id: job.id,
        location: location?.address || 'Location unavailable',
        gps_lat: location?.latitude,
        gps_lng: location?.longitude,
        gps_accuracy: location?.accuracy,
        gps_speed: location?.speed,
        gps_heading: location?.heading,
        location_verified: locationVerification?.isVerified || false,
        verification_distance: locationVerification?.distance,
        notes: notes.trim() || undefined,
        qr_check_in: true, // Flag to indicate this was a QR check-in
      }

      const response = await fetch('/api/time/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify(checkInData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Check-in failed')
      }

      setCheckInSuccess(true)
      toast.success('Successfully checked in via QR code!')
      
      // Redirect to dashboard after QR checkin timeout
      setTimeout(() => {
        router.push('/dashboard/time')
      }, TIMEOUTS.QR_CHECKIN_REDIRECT)

    } catch (error) {
      console.error('QR Check-in error:', error)
      toast.error(error instanceof Error ? error.message : 'Check-in failed')
    } finally {
      setIsCheckingIn(false)
    }
  }

  // Verify location when both location and job are available
  useEffect(() => {
    if (location && job) {
      verifyLocationAgainstJob()
    }
  }, [location, job])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading job details...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Job Not Found</h2>
            <p className="text-gray-600 mb-4">
              The job you're trying to check into could not be found.
            </p>
            <Button onClick={() => router.push('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (checkInSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-green-900 mb-2">Check-in Successful!</h2>
            <p className="text-gray-600 mb-4">
              You have successfully checked into {job.title}.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-800">
                Redirecting to time tracking dashboard...
              </p>
            </div>
            <Button onClick={() => router.push('/dashboard/time')}>
              Go to Time Tracking
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center mb-4">
              <QrCode className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">QR Code Check-In</CardTitle>
            <p className="text-gray-600">Quick check-in for job site workers</p>
          </CardHeader>
        </Card>

        {/* Job Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Job Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{job.title}</h3>
              <p className="text-gray-600">{job.client_name}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{job.location}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <Badge variant="outline">{job.status}</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Location Status */}
        {(location || locationVerification) && (
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
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

        {/* Check-in Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Check In
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <UserCheck className="h-4 w-4" />
                  <span className="font-medium">Authentication Required</span>
                </div>
                <p className="text-sm text-blue-600 mb-3">
                  You need to log in to check into this job site.
                </p>
                <Button onClick={() => router.push('/auth/login')} size="sm">
                  Log In
                </Button>
              </div>
            )}

            {user && user.role !== 'worker' && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-orange-700 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Worker Account Required</span>
                </div>
                <p className="text-sm text-orange-600">
                  Only worker accounts can check in via QR code.
                </p>
              </div>
            )}

            {user && user.role === 'worker' && !worker && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Worker Profile Not Found</span>
                </div>
                <p className="text-sm text-red-600">
                  Your worker profile could not be found. Please contact your supervisor.
                </p>
              </div>
            )}

            {/* Location Warning */}
            {locationVerification && !locationVerification.isVerified && (
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

            {/* Notes */}
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about your arrival or work status..."
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleCheckIn}
                disabled={isCheckingIn || !user || user.role !== 'worker' || !worker}
                className="flex-1 bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {isCheckingIn && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Clock className="h-4 w-4 mr-2" />
                Check In via QR
              </Button>
              
              <Button
                onClick={getCurrentLocation}
                disabled={isGettingLocation}
                variant="outline"
                size="lg"
              >
                {isGettingLocation && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Navigation className="h-4 w-4 mr-2" />
                {isGettingLocation ? 'Verifying...' : 'Refresh Location'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}