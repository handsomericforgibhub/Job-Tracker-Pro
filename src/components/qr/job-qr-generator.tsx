'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Job } from '@/lib/types'
import { 
  QrCode, 
  Download, 
  Copy, 
  ExternalLink,
  MapPin,
  Building2,
  Calendar
} from 'lucide-react'
import { toast } from 'sonner'

interface JobQRGeneratorProps {
  job: Job
  className?: string
}

export function JobQRGenerator({ job, className }: JobQRGeneratorProps) {
  const [qrSize, setQrSize] = useState(256)
  const [copySuccess, setCopySuccess] = useState(false)

  // Generate check-in URL with job information
  const checkInUrl = `${window.location.origin}/qr-checkin/${job.id}`
  
  const downloadQR = async () => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const qrElement = document.querySelector(`#qr-${job.id}`) as HTMLDivElement
      
      if (!ctx || !qrElement) {
        toast.error('Failed to generate QR code image')
        return
      }

      // Create a larger canvas for high quality
      const size = 512
      canvas.width = size
      canvas.height = size + 100 // Extra space for text
      
      // White background
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      
      // Get the SVG data
      const svgData = new XMLSerializer().serializeToString(qrElement.querySelector('svg')!)
      const img = new Image()
      
      img.onload = () => {
        // Draw QR code
        ctx.drawImage(img, 0, 0, size, size)
        
        // Add job title text
        ctx.fillStyle = 'black'
        ctx.font = 'bold 24px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(job.title, size / 2, size + 30)
        
        // Add subtitle
        ctx.font = '16px Arial'
        ctx.fillText('Scan to Check In', size / 2, size + 55)
        
        // Download the image
        const link = document.createElement('a')
        link.download = `job-${job.id}-qr-code.png`
        link.href = canvas.toDataURL()
        link.click()
        
        toast.success('QR code downloaded successfully!')
      }
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
    } catch (error) {
      console.error('Error downloading QR code:', error)
      toast.error('Failed to download QR code')
    }
  }

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
      toast.success('Check-in URL copied to clipboard!')
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = checkInUrl
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
      toast.success('Check-in URL copied to clipboard!')
    }
  }

  const openCheckInPage = () => {
    window.open(checkInUrl, '_blank')
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Job Site QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Job Information */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-600" />
            <span className="font-medium">{job.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-600">{job.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            <Badge variant="outline">
              {job.status}
            </Badge>
          </div>
        </div>

        {/* QR Code Display */}
        <div className="flex flex-col items-center space-y-4">
          <div 
            id={`qr-${job.id}`}
            className="p-4 bg-white rounded-lg border-2 border-gray-200"
          >
            <QRCode
              value={checkInUrl}
              size={qrSize}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              viewBox={`0 0 ${qrSize} ${qrSize}`}
            />
          </div>
          
          {/* Size Controls */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Size:</span>
            <select
              value={qrSize}
              onChange={(e) => setQrSize(Number(e.target.value))}
              className="text-sm border rounded px-2 py-1"
            >
              <option value={128}>Small (128px)</option>
              <option value={256}>Medium (256px)</option>
              <option value={512}>Large (512px)</option>
            </select>
          </div>
        </div>

        {/* Check-in URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Check-in URL:
          </label>
          <div className="bg-gray-50 border rounded-lg p-3">
            <code className="text-xs text-gray-700 break-all">
              {checkInUrl}
            </code>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Button
            onClick={copyUrl}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Copy className="h-4 w-4" />
            {copySuccess ? 'Copied!' : 'Copy URL'}
          </Button>
          
          <Button
            onClick={downloadQR}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download QR
          </Button>
          
          <Button
            onClick={openCheckInPage}
            size="sm"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Test Check-in
          </Button>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How to Use:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Print this QR code and post it at the job site</li>
            <li>• Workers can scan with their phone camera to quickly check in</li>
            <li>• The QR code contains GPS coordinates for location verification</li>
            <li>• Check-ins will be automatically logged with timestamp and location</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default JobQRGenerator