/**
 * React Query Hooks for Workers
 * 
 * ADR Phase 2: Server State Management Implementation
 * These hooks manage worker data with React Query for efficient caching
 * and real-time updates in the multi-tenant architecture.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Worker } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'

// =============================================
// Query Keys
// =============================================

export const workersQueryKeys = {
  all: ['workers'] as const,
  lists: () => [...workersQueryKeys.all, 'list'] as const,
  list: (filters?: any) => [...workersQueryKeys.lists(), filters] as const,
  details: () => [...workersQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...workersQueryKeys.details(), id] as const,
  skills: (id: string) => [...workersQueryKeys.detail(id), 'skills'] as const,
  licenses: (id: string) => [...workersQueryKeys.detail(id), 'licenses'] as const,
  assignments: (id: string) => [...workersQueryKeys.detail(id), 'assignments'] as const,
}

// =============================================
// Fetch Functions
// =============================================

async function fetchWorkers(): Promise<Worker[]> {
  const { data, error } = await supabase
    .from('workers')
    .select(`
      *,
      users(id, full_name, email, phone),
      worker_skills(
        id,
        skill_name,
        proficiency_level,
        years_experience
      ),
      worker_licenses(
        id,
        license_type,
        license_number,
        issue_date,
        expiry_date,
        is_active
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch workers: ${error.message}`)
  }

  return data || []
}

async function fetchWorkerById(id: string): Promise<Worker> {
  const { data, error } = await supabase
    .from('workers')
    .select(`
      *,
      users(id, full_name, email, phone),
      worker_skills(
        id,
        skill_name,
        proficiency_level,
        years_experience,
        created_at
      ),
      worker_licenses(
        id,
        license_type,
        license_number,
        issue_date,
        expiry_date,
        is_active,
        created_at
      ),
      job_assignments(
        id,
        job_id,
        role,
        status,
        start_date,
        end_date,
        jobs(id, title, status)
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch worker: ${error.message}`)
  }

  return data
}

async function fetchAvailableWorkers(jobId?: string): Promise<Worker[]> {
  let query = supabase
    .from('workers')
    .select(`
      *,
      users(id, full_name, email),
      worker_skills(skill_name, proficiency_level)
    `)
    .eq('is_active', true)

  if (jobId) {
    // Filter out workers already assigned to this job
    query = query.not('id', 'in', `(
      SELECT worker_id FROM job_assignments 
      WHERE job_id = '${jobId}' AND status = 'active'
    )`)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch available workers: ${error.message}`)
  }

  return data || []
}

async function createWorker(workerData: Partial<Worker>): Promise<Worker> {
  const { data, error } = await supabase
    .from('workers')
    .insert([workerData])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create worker: ${error.message}`)
  }

  return data
}

async function updateWorker(id: string, updates: Partial<Worker>): Promise<Worker> {
  const { data, error } = await supabase
    .from('workers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update worker: ${error.message}`)
  }

  return data
}

// =============================================
// Query Hooks
// =============================================

/**
 * Fetch all workers for the current user's company
 */
export function useWorkersQuery(filters?: any) {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: workersQueryKeys.list(filters),
    queryFn: fetchWorkers,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch a single worker by ID with full details
 */
export function useWorkerQuery(id: string) {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: workersQueryKeys.detail(id),
    queryFn: () => fetchWorkerById(id),
    enabled: !!user?.company_id && !!id,
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * Fetch available workers (not assigned to a specific job)
 */
export function useAvailableWorkersQuery(jobId?: string) {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: [...workersQueryKeys.lists(), 'available', jobId],
    queryFn: () => fetchAvailableWorkers(jobId),
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 2, // 2 minutes - availability changes frequently
  })
}

// =============================================
// Mutation Hooks
// =============================================

/**
 * Create a new worker
 */
export function useCreateWorkerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createWorker,
    onSuccess: (newWorker) => {
      // Invalidate workers list
      queryClient.invalidateQueries({ queryKey: workersQueryKeys.lists() })
      
      // Add the new worker to cache
      queryClient.setQueryData(workersQueryKeys.detail(newWorker.id), newWorker)
    },
    onError: (error) => {
      console.error('Failed to create worker:', error)
      // TODO: Add toast notification
    },
  })
}

/**
 * Update an existing worker
 */
export function useUpdateWorkerMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Worker> }) =>
      updateWorker(id, updates),
    onSuccess: (updatedWorker) => {
      // Update the worker in cache
      queryClient.setQueryData(workersQueryKeys.detail(updatedWorker.id), updatedWorker)
      
      // Invalidate workers list
      queryClient.invalidateQueries({ queryKey: workersQueryKeys.lists() })
    },
    onError: (error) => {
      console.error('Failed to update worker:', error)
      // TODO: Add toast notification
    },
  })
}

// =============================================
// Skills and Licenses Mutations
// =============================================

/**
 * Add a skill to a worker
 */
export function useAddWorkerSkillMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workerId, skill }: { 
      workerId: string; 
      skill: { skill_name: string; proficiency_level: string; years_experience?: number } 
    }) => {
      const { data, error } = await supabase
        .from('worker_skills')
        .insert([{ worker_id: workerId, ...skill }])
        .select()
        .single()

      if (error) throw new Error(`Failed to add skill: ${error.message}`)
      return data
    },
    onSuccess: (_, { workerId }) => {
      // Invalidate worker details to refresh skills
      queryClient.invalidateQueries({ queryKey: workersQueryKeys.detail(workerId) })
      queryClient.invalidateQueries({ queryKey: workersQueryKeys.skills(workerId) })
    },
  })
}

/**
 * Add a license to a worker
 */
export function useAddWorkerLicenseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ workerId, license }: { 
      workerId: string; 
      license: { 
        license_type: string; 
        license_number: string; 
        issue_date: string; 
        expiry_date?: string 
      } 
    }) => {
      const { data, error } = await supabase
        .from('worker_licenses')
        .insert([{ worker_id: workerId, ...license }])
        .select()
        .single()

      if (error) throw new Error(`Failed to add license: ${error.message}`)
      return data
    },
    onSuccess: (_, { workerId }) => {
      // Invalidate worker details to refresh licenses
      queryClient.invalidateQueries({ queryKey: workersQueryKeys.detail(workerId) })
      queryClient.invalidateQueries({ queryKey: workersQueryKeys.licenses(workerId) })
    },
  })
}

// =============================================
// Utility Hooks
// =============================================

/**
 * Get cached worker data without triggering a fetch
 */
export function useCachedWorker(id: string): Worker | undefined {
  const queryClient = useQueryClient()
  return queryClient.getQueryData(workersQueryKeys.detail(id))
}

/**
 * Prefetch a worker (useful for hover states or navigation)
 */
export function usePrefetchWorker() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return (id: string) => {
    if (!user?.company_id) return

    queryClient.prefetchQuery({
      queryKey: workersQueryKeys.detail(id),
      queryFn: () => fetchWorkerById(id),
      staleTime: 1000 * 60 * 5,
    })
  }
}