'use client'

import { useState, useRef, useEffect } from 'react'
import SignatureCanvas from 'react-signature-canvas'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { 
  PenTool, 
  RotateCcw, 
  Save, 
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  FileImage,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

interface SignatureCaptureProps {
  onSignatureCapture?: (signatureData: string) => void
  onSignatureClear?: () => void
  title?: string
  description?: string
  required?: boolean
  existingSignature?: string
  width?: number
  height?: number
  className?: string
  disabled?: boolean
}

export function SignatureCapture({
  onSignatureCapture,
  onSignatureClear,
  title = "Digital Signature",
  description = "Please sign below to confirm approval",
  required = false,
  existingSignature,
  width = 400,
  height = 200,
  className = "",
  disabled = false
}: SignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)
  const [signatureData, setSignatureData] = useState<string | null>(existingSignature || null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    if (existingSignature) {
      setSignatureData(existingSignature)
      setIsEmpty(false)
    }
  }, [existingSignature])

  const handleBeginDraw = () => {
    setIsDrawing(true)
  }

  const handleEndDraw = () => {
    setIsDrawing(false)
    if (signatureRef.current) {
      const isEmpty = signatureRef.current.isEmpty()
      setIsEmpty(isEmpty)
      
      if (!isEmpty) {
        const dataURL = signatureRef.current.toDataURL('image/png')
        setSignatureData(dataURL)
        onSignatureCapture?.(dataURL)
      }
    }
  }

  const clearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear()
      setIsEmpty(true)
      setSignatureData(null)
      onSignatureClear?.()
      toast.success('Signature cleared')
    }
  }

  const saveSignature = () => {
    if (signatureRef.current && !isEmpty) {
      const dataURL = signatureRef.current.toDataURL('image/png')
      setSignatureData(dataURL)
      onSignatureCapture?.(dataURL)
      toast.success('Signature captured successfully!')
    } else {
      toast.error('Please provide a signature first')
    }
  }

  const downloadSignature = () => {
    if (signatureData) {
      const link = document.createElement('a')
      link.download = `signature-${Date.now()}.png`
      link.href = signatureData
      link.click()
      toast.success('Signature downloaded!')
    } else {
      toast.error('No signature to download')
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const dataURL = e.target?.result as string
      if (dataURL) {
        setSignatureData(dataURL)
        setIsEmpty(false)
        onSignatureCapture?.(dataURL)
        toast.success('Signature uploaded successfully!')
      }
    }
    reader.readAsDataURL(file)
    
    // Reset file input
    event.target.value = ''
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          {title}
          {required && <Badge variant="destructive" className="text-xs">Required</Badge>}
        </CardTitle>
        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Signature Canvas */}
        <div className="relative">
          <Label className="text-sm font-medium text-gray-700 mb-2 block">
            Sign in the box below:
          </Label>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg relative bg-white">
            {signatureData && !isDrawing ? (
              // Display existing signature
              <div className="relative" style={{ width, height }}>
                <img 
                  src={signatureData} 
                  alt="Signature"
                  className="w-full h-full object-contain rounded-lg"
                />
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Signed
                  </Badge>
                </div>
              </div>
            ) : (
              // Signature canvas for drawing
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  width,
                  height,
                  className: 'rounded-lg',
                  style: { touchAction: 'none' }
                }}
                backgroundColor="white"
                penColor="black"
                minWidth={1}
                maxWidth={3}
                velocityFilterWeight={0.7}
                onBegin={handleBeginDraw}
                onEnd={handleEndDraw}
                clearOnResize={false}
                disabled={disabled}
              />
            )}
            
            {/* Overlay instructions */}
            {isEmpty && !signatureData && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-400">
                  <PenTool className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Click and drag to sign</p>
                  <p className="text-xs">or upload an image below</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={clearSignature}
            variant="outline"
            size="sm"
            disabled={disabled || (isEmpty && !signatureData)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear
          </Button>
          
          <Button
            onClick={saveSignature}
            size="sm"
            disabled={disabled || isEmpty}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Signature
          </Button>
          
          <Button
            onClick={downloadSignature}
            variant="outline"
            size="sm"
            disabled={!signatureData}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          
          {/* File upload */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => document.getElementById('signature-upload')?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
            <input
              id="signature-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={disabled}
            />
          </div>
        </div>

        {/* Signature Status */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            {signatureData ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Signature captured</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">No signature provided</span>
              </>
            )}
          </div>
          
          {signatureData && (
            <div className="text-xs text-gray-500">
              Signed at {new Date().toLocaleString()}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="font-medium text-blue-900 mb-1 text-sm">Instructions:</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Use mouse or touch to draw your signature</li>
            <li>• For best results, sign slowly and clearly</li>
            <li>• You can clear and redo your signature anytime</li>
            <li>• Alternatively, upload an image of your signature</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export default SignatureCapture