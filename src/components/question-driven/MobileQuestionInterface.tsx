'use client'

import { useState, useEffect } from 'react'
import { 
  QuestionFlowState, 
  StageQuestion, 
  QuestionFormData, 
  ResponseMetadata 
} from '@/lib/types/question-driven'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle, ArrowRight, HelpCircle, Upload } from 'lucide-react'

interface MobileQuestionInterfaceProps {
  jobId: string
  onQuestionAnswered?: (response: QuestionFormData) => void
  onStageComplete?: () => void
  className?: string
}

export default function MobileQuestionInterface({
  jobId,
  onQuestionAnswered,
  onStageComplete,
  className = ''
}: MobileQuestionInterfaceProps) {
  const [flowState, setFlowState] = useState<QuestionFlowState | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentResponse, setCurrentResponse] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  useEffect(() => {
    loadCurrentQuestion()
  }, [jobId])

  const loadCurrentQuestion = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/jobs/${jobId}/current-question`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load current question')
      }

      const data = await response.json()
      setFlowState(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitResponse = async () => {
    if (!flowState?.current_question) return

    try {
      setSubmitting(true)
      setError(null)

      // Validate response
      if (flowState.current_question.is_required && !currentResponse.trim()) {
        setError('This question is required')
        return
      }

      // Build response metadata
      const responseMetadata: ResponseMetadata = {
        timestamp: new Date().toISOString()
      }

      // Handle file uploads
      if (selectedFiles.length > 0) {
        responseMetadata.file_names = selectedFiles.map(f => f.name)
        responseMetadata.file_sizes = selectedFiles.map(f => f.size)
      }

      // Create form data
      const formData: QuestionFormData = {
        question_id: flowState.current_question.id,
        response_value: currentResponse,
        response_metadata: responseMetadata,
        files: selectedFiles
      }

      // Submit response
      const response = await fetch(`/api/jobs/${jobId}/stage-response`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question_id: formData.question_id,
          response_value: formData.response_value,
          response_metadata: formData.response_metadata
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit response')
      }

      const result = await response.json()
      
      // Notify parent component
      if (onQuestionAnswered) {
        onQuestionAnswered(formData)
      }

      // Clear form
      setCurrentResponse('')
      setSelectedFiles([])

      // Reload question flow
      await loadCurrentQuestion()

      // Check if stage is complete
      if (result.data.can_proceed && onStageComplete) {
        onStageComplete()
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
  }

  const renderQuestionInput = (question: StageQuestion) => {
    switch (question.response_type) {
      case 'yes_no':
        return (
          <div className="space-y-2">
            <Button
              variant={currentResponse === 'Yes' ? 'default' : 'outline'}
              onClick={() => setCurrentResponse('Yes')}
              className="w-full"
            >
              Yes
            </Button>
            <Button
              variant={currentResponse === 'No' ? 'default' : 'outline'}
              onClick={() => setCurrentResponse('No')}
              className="w-full"
            >
              No
            </Button>
          </div>
        )

      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.response_options?.map((option, index) => (
              <Button
                key={index}
                variant={currentResponse === option ? 'default' : 'outline'}
                onClick={() => setCurrentResponse(option)}
                className="w-full text-left justify-start"
              >
                {option}
              </Button>
            ))}
          </div>
        )

      case 'number':
        return (
          <input
            type="number"
            value={currentResponse}
            onChange={(e) => setCurrentResponse(e.target.value)}
            className="w-full p-3 border rounded-lg text-lg"
            placeholder="Enter number"
          />
        )

      case 'date':
        return (
          <input
            type="date"
            value={currentResponse}
            onChange={(e) => setCurrentResponse(e.target.value)}
            className="w-full p-3 border rounded-lg text-lg"
          />
        )

      case 'file_upload':
        return (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                accept={question.upload_file_types?.join(',') || '*'}
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600">
                  Tap to select files
                </p>
                {question.upload_file_types && (
                  <p className="text-xs text-gray-500 mt-1">
                    Accepted: {question.upload_file_types.join(', ')}
                  </p>
                )}
              </label>
            </div>
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <span className="text-xs text-gray-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )

      default:
        return (
          <textarea
            value={currentResponse}
            onChange={(e) => setCurrentResponse(e.target.value)}
            rows={4}
            className="w-full p-3 border rounded-lg text-lg resize-none"
            placeholder="Enter your response..."
          />
        )
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading question...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className={`${className}`} variant="destructive">
        <AlertDescription>{error}</AlertDescription>
        <Button onClick={loadCurrentQuestion} className="mt-2">
          Try Again
        </Button>
      </Alert>
    )
  }

  if (!flowState) {
    return (
      <Alert className={className}>
        <AlertDescription>No question flow data available</AlertDescription>
      </Alert>
    )
  }

  // Stage complete state
  if (flowState.can_proceed && !flowState.current_question) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-6 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Stage Complete!</h3>
          <p className="text-gray-600 mb-4">
            All questions for this stage have been answered.
          </p>
          {flowState.next_stage_preview && (
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Next Stage:</p>
              <div className="flex items-center justify-center">
                <Badge 
                  variant="secondary" 
                  className="text-sm"
                  style={{ backgroundColor: flowState.next_stage_preview.color }}
                >
                  {flowState.next_stage_preview.name}
                </Badge>
                <ArrowRight className="w-4 h-4 ml-2" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const question = flowState.current_question
  if (!question) {
    return (
      <Alert className={className}>
        <AlertDescription>No current question available</AlertDescription>
      </Alert>
    )
  }

  const progress = flowState.completed_questions.length / 
    (flowState.completed_questions.length + flowState.remaining_questions.length) * 100

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Question {flowState.completed_questions.length + 1}</span>
          <span>
            {flowState.completed_questions.length} of {flowState.completed_questions.length + flowState.remaining_questions.length} complete
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Question card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-start gap-2">
            <span className="flex-1">{question.question_text}</span>
            {question.help_text && (
              <div className="relative group">
                <HelpCircle className="w-5 h-5 text-gray-400 cursor-help" />
                <div className="absolute right-0 top-6 w-64 p-2 bg-gray-800 text-white text-sm rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  {question.help_text}
                </div>
              </div>
            )}
          </CardTitle>
          {question.is_required && (
            <Badge variant="destructive" className="text-xs w-fit">
              Required
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {renderQuestionInput(question)}
          
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={handleSubmitResponse}
            disabled={submitting || (!currentResponse.trim() && question.response_type !== 'file_upload')}
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Response'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}