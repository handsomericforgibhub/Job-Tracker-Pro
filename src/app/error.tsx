'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Something went wrong!
          </h2>
          <p className="text-gray-600 mb-4">
            An error occurred while loading the page.
          </p>
          <Button 
            onClick={() => reset()}
            className="w-full"
          >
            Try again
          </Button>
        </div>
      </div>
    </div>
  )
}