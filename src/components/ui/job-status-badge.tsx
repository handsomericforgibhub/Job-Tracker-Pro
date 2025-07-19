import React from 'react'
import { useJobStages } from '@/hooks/useJobStages'

interface JobStatusBadgeProps {
  status: string
  className?: string
  showLabel?: boolean
}

export default function JobStatusBadge({ 
  status, 
  className = '', 
  showLabel = true 
}: JobStatusBadgeProps) {
  const { getStageByKey, loading } = useJobStages()

  if (loading) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 ${className}`}>
        Loading...
      </span>
    )
  }

  const stage = getStageByKey(status)

  if (!stage) {
    // Fallback for unknown status
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 ${className}`}>
        {showLabel ? status : ''}
      </span>
    )
  }

  // Calculate text color based on background color brightness
  const getTextColor = (backgroundColor: string): string => {
    // Convert hex to RGB
    const hex = backgroundColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Calculate brightness (perceived luminance)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000
    
    // Return white for dark backgrounds, black for light backgrounds
    return brightness > 128 ? '#000000' : '#FFFFFF'
  }

  const textColor = getTextColor(stage.color)
  const backgroundOpacity = showLabel ? '1' : '0.8'

  return (
    <span 
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ 
        backgroundColor: stage.color + (backgroundOpacity !== '1' ? Math.round(parseFloat(backgroundOpacity) * 255).toString(16).padStart(2, '0') : ''),
        color: textColor
      }}
      title={stage.description}
    >
      {showLabel && stage.label}
    </span>
  )
}

// Export specialized variants
export function JobStatusDot({ status, className = '' }: Pick<JobStatusBadgeProps, 'status' | 'className'>) {
  return (
    <JobStatusBadge 
      status={status} 
      showLabel={false} 
      className={`w-3 h-3 rounded-full p-0 ${className}`} 
    />
  )
}

export function JobStatusLabel({ status, className = '' }: Pick<JobStatusBadgeProps, 'status' | 'className'>) {
  return (
    <JobStatusBadge 
      status={status} 
      showLabel={true} 
      className={className} 
    />
  )
}