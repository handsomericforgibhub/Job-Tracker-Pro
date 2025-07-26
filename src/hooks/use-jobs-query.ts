/**
 * React Query Hooks for Jobs
 * 
 * ADR Phase 2: Server State Management Implementation
 * These hooks replace direct fetch calls with React Query for better
 * caching, background updates, and error handling.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Job, JobStatus } from '@/lib/types'
import { useAuthStore } from '@/stores/auth-store'

// =============================================
// Query Keys (for cache management)
// =============================================

export const jobsQueryKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobsQueryKeys.all, 'list'] as const,
  list: (filters?: any) => [...jobsQueryKeys.lists(), filters] as const,
  details: () => [...jobsQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobsQueryKeys.details(), id] as const,
  statusHistory: (id: string) => [...jobsQueryKeys.detail(id), 'status-history'] as const,
  auditHistory: (id: string) => [...jobsQueryKeys.detail(id), 'audit-history'] as const,
}

// =============================================
// Fetch Functions
// =============================================

async function fetchJobs(): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      foreman:users!jobs_foreman_id_fkey(id, full_name, email),
      current_stage:job_stages!current_stage_id(*)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch jobs: ${error.message}`)
  }

  return data || []
}

async function fetchJobById(id: string): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      foreman:users!jobs_foreman_id_fkey(id, full_name, email),
      current_stage:job_stages!current_stage_id(*),
      project:projects(*)
    `)
    .eq('id', id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch job: ${error.message}`)
  }

  return data
}

async function fetchJobStatusHistory(jobId: string) {
  const { data, error } = await supabase
    .from('job_status_history')
    .select(`
      *,
      changed_by:users(full_name, email)
    `)
    .eq('job_id', jobId)
    .order('changed_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch job status history: ${error.message}`)
  }

  return data || []
}

async function createJob(jobData: Partial<Job>): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .insert([jobData])
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create job: ${error.message}`)
  }

  return data
}

async function updateJob(id: string, updates: Partial<Job>): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update job: ${error.message}`)
  }

  return data
}

async function updateJobStatus(id: string, status: JobStatus, notes?: string): Promise<Job> {
  const { data, error } = await supabase
    .rpc('update_job_status', {
      p_job_id: id,
      p_new_status: status,
      p_notes: notes || null
    })

  if (error) {
    throw new Error(`Failed to update job status: ${error.message}`)
  }

  return data
}

// =============================================
// Query Hooks
// =============================================

/**
 * Fetch all jobs for the current user's company
 */
export function useJobsQuery(filters?: any) {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: jobsQueryKeys.list(filters),
    queryFn: fetchJobs,
    enabled: !!user?.company_id,
    staleTime: 1000 * 60 * 2, // 2 minutes - jobs change frequently
  })
}

/**
 * Fetch a single job by ID
 */
export function useJobQuery(id: string) {
  const { user } = useAuthStore()

  return useQuery({
    queryKey: jobsQueryKeys.detail(id),
    queryFn: () => fetchJobById(id),
    enabled: !!user?.company_id && !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Fetch job status history
 */
export function useJobStatusHistoryQuery(jobId: string) {
  return useQuery({
    queryKey: jobsQueryKeys.statusHistory(jobId),
    queryFn: () => fetchJobStatusHistory(jobId),
    enabled: !!jobId,
    staleTime: 1000 * 60 * 10, // 10 minutes - history doesn't change often
  })
}

// =============================================
// Mutation Hooks
// =============================================

/**
 * Create a new job
 */
export function useCreateJobMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createJob,
    onSuccess: (newJob) => {
      // Invalidate jobs list to show the new job
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() })
      
      // Add the new job to cache
      queryClient.setQueryData(jobsQueryKeys.detail(newJob.id), newJob)
    },
    onError: (error) => {
      console.error('Failed to create job:', error)
      // TODO: Add toast notification
    },
  })
}

/**
 * Update an existing job
 */
export function useUpdateJobMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Job> }) =>
      updateJob(id, updates),
    onSuccess: (updatedJob) => {
      // Update the job in cache
      queryClient.setQueryData(jobsQueryKeys.detail(updatedJob.id), updatedJob)
      
      // Invalidate jobs list to reflect changes
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() })
    },
    onError: (error) => {
      console.error('Failed to update job:', error)
      // TODO: Add toast notification
    },
  })
}

/**
 * Update job status with automatic history tracking
 */
export function useUpdateJobStatusMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: JobStatus; notes?: string }) =>
      updateJobStatus(id, status, notes),
    onSuccess: (updatedJob) => {
      // Update the job in cache
      queryClient.setQueryData(jobsQueryKeys.detail(updatedJob.id), updatedJob)
      
      // Invalidate jobs list and status history
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.statusHistory(updatedJob.id) })
    },
    onError: (error) => {
      console.error('Failed to update job status:', error)
      // TODO: Add toast notification
    },
  })
}

// =============================================
// Utility Hooks
// =============================================

/**
 * Get cached job data without triggering a fetch
 */
export function useCachedJob(id: string): Job | undefined {
  const queryClient = useQueryClient()
  return queryClient.getQueryData(jobsQueryKeys.detail(id))
}

/**
 * Prefetch a job (useful for hover states or navigation)
 */
export function usePrefetchJob() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return (id: string) => {
    if (!user?.company_id) return

    queryClient.prefetchQuery({
      queryKey: jobsQueryKeys.detail(id),
      queryFn: () => fetchJobById(id),
      staleTime: 1000 * 60 * 5,
    })
  }
}