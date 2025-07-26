'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Camera, 
  Square, 
  RotateCcw,
  Zap,
  AlertCircle,
  CheckCircle,
  ScanLine,
  Upload
} from 'lucide-react'
import { toast } from 'sonner'

interface QRScannerProps {
  onScanSuccess: (data: string) => void
  onScanError?: (error: string) => void
  className?: string
}

export function QRScanner({ onScanSuccess, onScanError, className }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [hasPermission, setHasPermission] = useState(false)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [lastScanTime, setLastScanTime] = useState(0)

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopScanning()
    }
  }, [])

  const startScanning = async () => {
    try {
      // Request camera permission
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      })

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
        videoRef.current.play()
        setStream(mediaStream)
        setHasPermission(true)
        setIsScanning(true)
        
        // Start scanning loop
        scanLoop()
        toast.success('Camera started. Point at a QR code to scan.')
      }
    } catch (error) {
      console.error('Error accessing camera:', error)
      const errorMsg = error instanceof Error ? error.message : 'Camera access denied'
      onScanError?.(errorMsg)
      toast.error(`Camera error: ${errorMsg}`)
    }
  }

  const stopScanning = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setIsScanning(false)
    setHasPermission(false)
  }

  const switchCamera = async () => {
    stopScanning()
    setFacingMode(facingMode === 'user' ? 'environment' : 'user')
    // Small delay to ensure cleanup
    setTimeout(() => {
      startScanning()
    }, 100)
  }

  const scanLoop = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanLoop)
      return
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Try to scan QR code from canvas
    try {
      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      // This is a simplified QR detection - in a real implementation you'd use a proper QR library
      // For now, we'll use a workaround with the qr-scanner library
      scanQRFromCanvas(canvas)
    } catch (error) {
      // Continue scanning
    }

    // Continue scanning if still active
    if (isScanning) {
      requestAnimationFrame(scanLoop)
    }
  }

  const scanQRFromCanvas = async (canvas: HTMLCanvasElement) => {
    try {
      // Convert canvas to blob and use qr-scanner
      canvas.toBlob(async (blob) => {
        if (!blob) return

        try {
          // Use dynamic import to load qr-scanner
          const QrScanner = (await import('qr-scanner')).default
          const result = await QrScanner.scanImage(blob)
          
          // Throttle scans to prevent spam
          const now = Date.now()
          if (now - lastScanTime < 2000) return
          setLastScanTime(now)
          
          onScanSuccess(result)
          toast.success('QR code scanned successfully!')
          
        } catch (scanError) {
          // No QR code found, continue scanning
        }
      }, 'image/jpeg', 0.8)
    } catch (error) {
      // Continue scanning
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      // Use dynamic import to load qr-scanner
      const QrScanner = (await import('qr-scanner')).default
      const result = await QrScanner.scanImage(file)
      onScanSuccess(result)
      toast.success('QR code scanned from image!')
    } catch (error) {
      const errorMsg = 'No QR code found in the image'
      onScanError?.(errorMsg)
      toast.error(errorMsg)
    }

    // Reset file input
    event.target.value = ''
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ScanLine className="h-5 w-5" />
          QR Code Scanner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasPermission && !isScanning && (
          <div className="text-center space-y-4">
            <div className="w-64 h-48 mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
              <Camera className="h-12 w-12 text-gray-400" />
            </div>
            
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                Allow camera access to scan QR codes
              </p>
              <Button onClick={startScanning} className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            </div>
          </div>
        )}

        {isScanning && (
          <div className="space-y-4">
            {/* Video Preview */}
            <div className="relative w-full max-w-md mx-auto">
              <video
                ref={videoRef}
                className="w-full h-64 bg-black rounded-lg object-cover"
                playsInline
                muted
              />
              
              {/* Scanning Overlay */}
              <div className="absolute inset-0 border-2 border-blue-500 rounded-lg">
                <div className="absolute inset-4 border border-white/50 rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-blue-400"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-blue-400"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-blue-400"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-blue-400"></div>
                </div>
                
                {/* Status Indicator */}
                <div className="absolute top-2 left-2">
                  <Badge variant="secondary" className="bg-blue-500 text-white">
                    <Zap className="h-3 w-3 mr-1" />
                    Scanning...
                  </Badge>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex gap-2">
              <Button onClick={switchCamera} variant="outline" size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                Switch Camera
              </Button>
              
              <Button onClick={stopScanning} variant="outline" size="sm">
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            </div>
          </div>
        )}

        {/* File Upload Option */}
        <div className="border-t pt-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-600">Or upload an image with QR code</p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Scanning Tips:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Hold your device steady</li>
            <li>• Ensure good lighting</li>
            <li>• Keep QR code fully in view</li>
            <li>• Try different distances if scanning fails</li>
          </ul>
        </div>

        {/* Hidden canvas for QR processing */}
        <canvas ref={canvasRef} className="hidden" />
      </CardContent>
    </Card>
  )
}

export default QRScanner