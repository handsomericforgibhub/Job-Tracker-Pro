'use client'

import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectWithValueProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  options: SelectOption[]
  children?: React.ReactNode
}

/**
 * A Select component that properly displays the selected value in the trigger.
 * This solves the common issue where SelectValue doesn't show the selected option.
 * 
 * Usage:
 * <SelectWithValue
 *   value={selectedValue}
 *   onValueChange={handleChange}
 *   placeholder="Select an option..."
 *   options={[
 *     { value: "option1", label: "Option 1" },
 *     { value: "option2", label: "Option 2" }
 *   ]}
 * />
 * 
 * Or with children for custom SelectItems:
 * <SelectWithValue value={value} onValueChange={onChange}>
 *   <SelectItem value="custom">Custom Option</SelectItem>
 * </SelectWithValue>
 */
export function SelectWithValue({
  value,
  onValueChange,
  placeholder = "Select an option...",
  disabled = false,
  className,
  triggerClassName,
  options,
  children
}: SelectWithValueProps) {
  // Find the selected option to display its label
  const selectedOption = options.find(opt => opt.value === value)
  const displayValue = selectedOption?.label || placeholder

  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectTrigger className={triggerClassName}>
        <span className="truncate">
          {displayValue}
        </span>
      </SelectTrigger>
      <SelectContent className={className}>
        {children ? children : options.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SelectWithValue