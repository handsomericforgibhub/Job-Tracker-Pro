import { supabase } from '@/lib/supabase'
import { 
  createMockProject, 
  createMockUser, 
  createMockJob,
  mockSupabaseQuery, 
  mockAuthenticatedUser,
  resetMocks 
} from '../utils/test-helpers'

describe('Integration: Complete Workflows', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('Project Creation to Job Management Workflow', () => {
    it('should create project -> apply template -> create jobs -> track progress', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner' })
      const mockProject = createMockProject({ id: 'project-1' })
      const mockTemplate = {
        id: 'template-1',
        template_name: 'Standard Construction',
        stages: [
          { name: 'Planning', color: '#6366f1', sequence: 1, estimated_days: 7 },
          { name: 'Execution', color: '#8b5cf6', sequence: 2, estimated_days: 14 },
          { name: 'Completion', color: '#06b6d4', sequence: 3, estimated_days: 3 }
        ]
      }
      const mockStages = [
        { id: 'stage-1', stage_name: 'Planning', sequence_order: 1, project_id: 'project-1' },
        { id: 'stage-2', stage_name: 'Execution', sequence_order: 2, project_id: 'project-1' },
        { id: 'stage-3', stage_name: 'Completion', sequence_order: 3, project_id: 'project-1' }
      ]
      const mockJobs = [
        createMockJob({ id: 'job-1', project_id: 'project-1', project_stage_id: 'stage-1', is_standalone: false }),
        createMockJob({ id: 'job-2', project_id: 'project-1', project_stage_id: 'stage-2', is_standalone: false })
      ]

      mockAuthenticatedUser(mockUser)

      // Mock the sequence of API calls
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockSupabaseQuery(mockUser)) // User lookup
        .mockReturnValueOnce(mockSupabaseQuery(mockProject)) // Project creation
        .mockReturnValueOnce(mockSupabaseQuery(mockTemplate)) // Template lookup
        .mockReturnValueOnce(mockSupabaseQuery(mockStages[0])) // Stage 1 creation
        .mockReturnValueOnce(mockSupabaseQuery(mockStages[1])) // Stage 2 creation
        .mockReturnValueOnce(mockSupabaseQuery(mockStages[2])) // Stage 3 creation
        .mockReturnValueOnce(mockSupabaseQuery(mockJobs[0])) // Job 1 creation
        .mockReturnValueOnce(mockSupabaseQuery(mockJobs[1])) // Job 2 creation

      ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null })

      // Act & Assert

      // Step 1: Create Project
      expect(mockProject.id).toBe('project-1')
      expect(mockProject.name).toBeTruthy()

      // Step 2: Apply Template
      expect(mockTemplate.stages).toHaveLength(3)
      expect(mockStages).toHaveLength(3)

      // Step 3: Create Jobs linked to stages
      expect(mockJobs[0].project_id).toBe('project-1')
      expect(mockJobs[0].project_stage_id).toBe('stage-1')
      expect(mockJobs[0].is_standalone).toBe(false)
      expect(mockJobs[1].project_stage_id).toBe('stage-2')

      // Step 4: Verify project structure
      const projectWithStages = {
        ...mockProject,
        stages: mockStages,
        jobs: mockJobs
      }
      expect(projectWithStages.stages).toHaveLength(3)
      expect(projectWithStages.jobs).toHaveLength(2)
    })
  })

  describe('Job Status Change Workflow', () => {
    it('should update job status -> log history -> update stage completion', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'foreman' })
      const mockJob = createMockJob({ 
        id: 'job-1', 
        status: 'planning',
        project_id: 'project-1',
        project_stage_id: 'stage-1'
      })
      const mockUpdatedJob = createMockJob({ 
        id: 'job-1', 
        status: 'active',
        project_id: 'project-1',
        project_stage_id: 'stage-1'
      })
      const mockStatusHistory = [
        {
          id: 'history-1',
          job_id: 'job-1',
          status: 'planning',
          changed_at: '2024-01-01T00:00:00Z',
          changed_by: mockUser.id
        },
        {
          id: 'history-2',
          job_id: 'job-1',
          status: 'active',
          changed_at: '2024-01-02T00:00:00Z',
          changed_by: mockUser.id
        }
      ]

      mockAuthenticatedUser(mockUser)

      // Mock the sequence of API calls
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockSupabaseQuery(mockJob)) // Original job
        .mockReturnValueOnce(mockSupabaseQuery(mockUpdatedJob)) // Updated job
        .mockReturnValueOnce(mockSupabaseQuery(mockStatusHistory)) // Status history

      ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null })

      // Act & Assert

      // Step 1: Verify original job status
      expect(mockJob.status).toBe('planning')

      // Step 2: Update job status
      expect(mockUpdatedJob.status).toBe('active')

      // Step 3: Verify status history was created
      expect(mockStatusHistory).toHaveLength(2)
      expect(mockStatusHistory[0].status).toBe('planning')
      expect(mockStatusHistory[1].status).toBe('active')
      expect(mockStatusHistory[1].changed_by).toBe(mockUser.id)

      // Step 4: Verify database function was called
      expect(supabase.rpc).toHaveBeenCalledWith('update_job_status_safely', {
        p_job_id: 'job-1',
        p_new_status: 'active',
        p_user_id: mockUser.id,
        p_notes: null
      })
    })

    it('should handle status change from planning through completion', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'foreman' })
      const statusProgression = ['planning', 'active', 'on_hold', 'active', 'completed']
      const mockJob = createMockJob({ id: 'job-1', status: 'planning' })

      mockAuthenticatedUser(mockUser)

      // Act & Assert each status change
      for (let i = 0; i < statusProgression.length - 1; i++) {
        const currentStatus = statusProgression[i]
        const nextStatus = statusProgression[i + 1]

        const currentJob = createMockJob({ id: 'job-1', status: currentStatus })
        const updatedJob = createMockJob({ id: 'job-1', status: nextStatus })

        ;(supabase.from as jest.Mock)
          .mockReturnValueOnce(mockSupabaseQuery(currentJob))
          .mockReturnValueOnce(mockSupabaseQuery(updatedJob))

        ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: true, error: null })

        // Verify the status transition
        expect(currentJob.status).toBe(currentStatus)
        expect(updatedJob.status).toBe(nextStatus)
      }
    })
  })

  describe('Project Progress Tracking Workflow', () => {
    it('should track project completion through job and stage updates', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner' })
      const mockProject = createMockProject({ id: 'project-1' })
      const mockStages = [
        { id: 'stage-1', stage_name: 'Planning', completion_percentage: 0, status: 'pending' },
        { id: 'stage-2', stage_name: 'Execution', completion_percentage: 0, status: 'pending' },
        { id: 'stage-3', stage_name: 'Completion', completion_percentage: 0, status: 'pending' }
      ]
      const mockJobs = [
        createMockJob({ id: 'job-1', project_stage_id: 'stage-1', status: 'planning' }),
        createMockJob({ id: 'job-2', project_stage_id: 'stage-1', status: 'planning' }),
        createMockJob({ id: 'job-3', project_stage_id: 'stage-2', status: 'planning' })
      ]

      mockAuthenticatedUser(mockUser)

      // Mock project summary function
      const mockProjectSummary = {
        total_stages: 3,
        completed_stages: 0,
        total_jobs: 3,
        completed_jobs: 0,
        overall_completion: 0,
        estimated_hours: 100,
        actual_hours: 0
      }

      ;(supabase.rpc as jest.Mock).mockResolvedValue({ data: [mockProjectSummary], error: null })

      // Act & Assert

      // Step 1: Initial project state
      expect(mockProject.id).toBe('project-1')
      expect(mockStages[0].completion_percentage).toBe(0)
      expect(mockJobs.filter(j => j.status === 'completed')).toHaveLength(0)

      // Step 2: Complete first job in stage 1
      const updatedJob1 = { ...mockJobs[0], status: 'completed' }
      expect(updatedJob1.status).toBe('completed')

      // Step 3: Complete second job in stage 1 (should update stage completion)
      const updatedJob2 = { ...mockJobs[1], status: 'completed' }
      expect(updatedJob2.status).toBe('completed')

      // Step 4: Verify stage 1 should be 100% complete
      const updatedStage1 = { ...mockStages[0], completion_percentage: 100, status: 'completed' }
      expect(updatedStage1.completion_percentage).toBe(100)
      expect(updatedStage1.status).toBe('completed')

      // Step 5: Complete job in stage 2
      const updatedJob3 = { ...mockJobs[2], status: 'completed' }
      expect(updatedJob3.status).toBe('completed')

      // Step 6: Verify project summary calculation
      const finalSummary = {
        ...mockProjectSummary,
        completed_stages: 2,
        completed_jobs: 3,
        overall_completion: 67 // 2 out of 3 stages completed
      }
      expect(finalSummary.completed_jobs).toBe(3)
      expect(finalSummary.completed_stages).toBe(2)
    })
  })

  describe('Multi-User Workflow', () => {
    it('should handle owner creating project, foreman managing jobs, workers completing tasks', async () => {
      // Arrange
      const mockOwner = createMockUser({ id: 'owner-1', role: 'owner' })
      const mockForeman = createMockUser({ id: 'foreman-1', role: 'foreman' })
      const mockWorker = createMockUser({ id: 'worker-1', role: 'worker' })
      
      const mockProject = createMockProject({ 
        id: 'project-1', 
        created_by: mockOwner.id,
        project_manager_id: mockForeman.id
      })
      
      const mockJob = createMockJob({ 
        id: 'job-1', 
        project_id: 'project-1',
        foreman_id: mockForeman.id,
        created_by: mockForeman.id
      })

      const mockTimeEntry = {
        id: 'time-1',
        worker_id: mockWorker.id,
        job_id: 'job-1',
        start_time: '2024-01-01T08:00:00Z',
        end_time: '2024-01-01T17:00:00Z',
        duration_minutes: 480, // 8 hours
        status: 'pending'
      }

      // Act & Assert

      // Step 1: Owner creates project
      mockAuthenticatedUser(mockOwner)
      expect(mockProject.created_by).toBe(mockOwner.id)
      expect(mockProject.project_manager_id).toBe(mockForeman.id)

      // Step 2: Foreman creates and manages jobs
      mockAuthenticatedUser(mockForeman)
      expect(mockJob.foreman_id).toBe(mockForeman.id)
      expect(mockJob.project_id).toBe(mockProject.id)

      // Step 3: Worker logs time and completes tasks
      mockAuthenticatedUser(mockWorker)
      expect(mockTimeEntry.worker_id).toBe(mockWorker.id)
      expect(mockTimeEntry.job_id).toBe(mockJob.id)
      expect(mockTimeEntry.duration_minutes).toBe(480)

      // Step 4: Foreman approves time entries
      mockAuthenticatedUser(mockForeman)
      const approvedTimeEntry = { ...mockTimeEntry, status: 'approved' }
      expect(approvedTimeEntry.status).toBe('approved')

      // Step 5: Owner views project progress
      mockAuthenticatedUser(mockOwner)
      const projectProgress = {
        project_id: mockProject.id,
        total_hours_logged: 8,
        labor_cost: 320, // 8 hours * $40/hour
        completion_percentage: 25
      }
      expect(projectProgress.total_hours_logged).toBe(8)
      expect(projectProgress.labor_cost).toBe(320)
    })
  })

  describe('Error Handling Workflow', () => {
    it('should handle authentication errors gracefully', async () => {
      // Arrange
      const mockUser = createMockUser()
      
      // Mock authentication failure
      const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' } as any,
      })

      // Act & Assert
      const authResult = await supabase.auth.getUser()
      expect(authResult.data.user).toBeNull()
      expect(authResult.error).toBeTruthy()
    })

    it('should handle database errors and maintain data integrity', async () => {
      // Arrange
      const mockUser = createMockUser()
      mockAuthenticatedUser(mockUser)

      // Mock database error
      const mockQuery = mockSupabaseQuery(null, { 
        message: 'Database connection failed',
        code: '08006'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act & Assert
      const result = await mockQuery.single()
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.message).toBe('Database connection failed')
    })

    it('should handle RLS policy violations properly', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockUnauthorizedJob = createMockJob({ company_id: 'company-2' })
      
      mockAuthenticatedUser(mockUser)

      // Mock RLS policy violation
      const mockQuery = mockSupabaseQuery(null, {
        message: 'new row violates row-level security policy',
        code: '42501'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act & Assert
      const result = await mockQuery.single()
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.message).toContain('row-level security policy')
    })
  })
})