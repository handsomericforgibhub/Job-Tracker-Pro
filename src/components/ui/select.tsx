"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Select = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string
    onValueChange?: (value: string) => void
    defaultValue?: string
    disabled?: boolean
  }
>(({ className, children, value, onValueChange, defaultValue, disabled, ...props }, ref) => {
  const [internalValue, setInternalValue] = React.useState(value || defaultValue || "")
  const [isOpen, setIsOpen] = React.useState(false)

  // Update internal value when external value changes
  React.useEffect(() => {
    if (value !== undefined) {
      setInternalValue(value)
    }
  }, [value])

  const currentValue = value !== undefined ? value : internalValue

  const handleValueChange = (newValue: string) => {
    setInternalValue(newValue)
    onValueChange?.(newValue)
    setIsOpen(false)
  }

  return (
    <div ref={ref} className={cn("relative", className)} {...props}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            value: currentValue,
            onValueChange: handleValueChange,
            isOpen,
            setIsOpen,
            disabled
          })
        }
        return child
      })}
    </div>
  )
})
Select.displayName = "Select"

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value?: string
    isOpen?: boolean
    setIsOpen?: (open: boolean) => void
    onValueChange?: (value: string) => void
  }
>(({ className, children, value, isOpen, setIsOpen, disabled, onValueChange, ...props }, ref) => {
  
  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => setIsOpen?.(!isOpen)}
    >
      <span className="truncate">{children}</span>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    placeholder?: string
    value?: string
  }
>(({ className, placeholder, value, children, ...props }, ref) => {
  // If children are provided, use them (for custom display logic)
  if (children) {
    return (
      <span
        ref={ref}
        className={cn("truncate", !value && "text-muted-foreground", className)}
        {...props}
      >
        {children}
      </span>
    )
  }

  // Otherwise show placeholder
  return (
    <span
      ref={ref}
      className={cn("truncate", "text-muted-foreground", className)}
      {...props}
    >
      {placeholder}
    </span>
  )
})
SelectValue.displayName = "SelectValue"

const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    isOpen?: boolean
    value?: string
    onValueChange?: (value: string) => void
    setIsOpen?: (open: boolean) => void
  }
>(({ className, children, isOpen, value, onValueChange, setIsOpen, ...props }, ref) => {
  if (!isOpen) return null

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-full left-0 z-50 w-full mt-1 bg-white border border-gray-200 shadow-lg rounded-md py-1 max-h-60 overflow-auto",
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            selectedValue: value,
            onSelect: onValueChange
          })
        }
        return child
      })}
    </div>
  )
})
SelectContent.displayName = "SelectContent"

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value: string
    selectedValue?: string
    onSelect?: (value: string) => void
  }
>(({ className, children, value, selectedValue, onSelect, ...props }, ref) => {
  const isSelected = value === selectedValue

  const handleClick = () => {
    onSelect?.(value)
  }

  return (
    <div
      ref={ref}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100",
        isSelected && "bg-gray-100",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {isSelected && (
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          <Check className="h-4 w-4" />
        </span>
      )}
      {children}
    </div>
  )
})
SelectItem.displayName = "SelectItem"

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
}