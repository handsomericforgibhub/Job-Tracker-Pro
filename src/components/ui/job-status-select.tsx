import React from 'react'
import { useJobStages, JobStage } from '@/hooks/useJobStages'

interface JobStatusSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  currentStage?: string // If provided, will filter to only allowed transitions
  showInitialOnly?: boolean // If true, will only show initial stages (for new jobs)
  placeholder?: string
}

export default function JobStatusSelect({
  value,
  onChange,
  disabled = false,
  className = '',
  currentStage,
  showInitialOnly = false,
  placeholder = 'Select status'
}: JobStatusSelectProps) {
  const { stages, loading, error } = useJobStages()

  // Filter stages based on props
  const getAvailableStages = (): JobStage[] => {
    if (showInitialOnly) {
      return stages.filter(stage => stage.is_initial)
    }

    if (currentStage) {
      const current = stages.find(s => s.key === currentStage)
      if (current) {
        // Include current stage and allowed transitions
        const transitionStages = current.allowed_transitions
          .map(key => stages.find(s => s.key === key))
          .filter((stage): stage is JobStage => stage !== undefined)
        
        return [current, ...transitionStages]
      }
    }

    return stages
  }

  const availableStages = getAvailableStages()

  if (loading) {
    return (
      <select
        disabled
        className={`w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 ${className}`}
      >
        <option>Loading stages...</option>
      </select>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm">
        Error loading job stages: {error}
      </div>
    )
  }

  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          disabled ? 'bg-gray-50 text-gray-500' : ''
        } ${className}`}
      >
        {!value && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {availableStages.map((stage) => (
          <option key={stage.key} value={stage.key}>
            {stage.label}
            {stage.is_initial && ' (Initial)'}
            {stage.is_final && ' (Final)'}
          </option>
        ))}
      </select>
      
      {/* Show stage description if a stage is selected */}
      {value && (
        <div className="mt-1">
          {(() => {
            const selectedStage = stages.find(s => s.key === value)
            if (selectedStage) {
              return (
                <div className="flex items-center text-xs text-gray-600">
                  <div 
                    className="w-2 h-2 rounded-full mr-2"
                    style={{ backgroundColor: selectedStage.color }}
                  />
                  {selectedStage.description}
                </div>
              )
            }
            return null
          })()}
        </div>
      )}
    </div>
  )
}

// Export a specialized component for new jobs that only shows initial stages
export function NewJobStatusSelect(props: Omit<JobStatusSelectProps, 'showInitialOnly'>) {
  return <JobStatusSelect {...props} showInitialOnly={true} />
}

// Export a specialized component for job editing that respects transitions
export function EditJobStatusSelect(props: JobStatusSelectProps) {
  return <JobStatusSelect {...props} />
}