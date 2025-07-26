'use client'

/**
 * React Query Provider Setup
 * 
 * ADR Phase 2: Server State Management with React Query
 * This provider configures React Query for efficient server state management
 * with proper caching, background updates, and error handling.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

interface QueryProviderProps {
  children: React.ReactNode
}

export default function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient with optimized settings for multi-tenant SaaS
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 5 minutes by default
        staleTime: 1000 * 60 * 5,
        // Keep data in cache for 10 minutes after components unmount
        gcTime: 1000 * 60 * 10,
        // Retry failed requests 2 times
        retry: 2,
        // Retry with exponential backoff
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        // Refetch on window focus for real-time updates
        refetchOnWindowFocus: true,
        // Don't refetch on reconnect unless data is stale
        refetchOnReconnect: 'always',
      },
      mutations: {
        // Retry mutations once on failure
        retry: 1,
        // Show user-friendly error messages
        onError: (error: any) => {
          console.error('Mutation failed:', error)
          // TODO: Add toast notification system
        },
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}