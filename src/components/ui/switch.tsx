"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  label?: string
  onLabel?: string
  offLabel?: string
  showLabels?: boolean
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, label, onLabel = "Yes", offLabel = "No", showLabels = false, checked, ...props }, ref) => (
  <div className="flex items-center gap-2">
    <SwitchPrimitives.Root
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        // Enhanced contrast colors
        "data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-300",
        // Hover states for better UX
        "hover:data-[state=checked]:bg-blue-700 hover:data-[state=unchecked]:bg-gray-400",
        className
      )}
      checked={checked}
      {...props}
      ref={ref}
    >
      <SwitchPrimitives.Thumb
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitives.Root>
    {showLabels && (
      <span className={cn(
        "text-sm font-medium transition-colors",
        checked ? "text-blue-600" : "text-gray-500"
      )}>
        {checked ? onLabel : offLabel}
      </span>
    )}
    {label && !showLabels && (
      <span className="text-sm font-medium text-gray-700">{label}</span>
    )}
  </div>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }