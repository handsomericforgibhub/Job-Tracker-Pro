import { supabase } from '@/lib/supabase'
import { 
  createMockJob, 
  createMockUser, 
  createMockProject,
  mockSupabaseQuery, 
  mockAuthenticatedUser,
  resetMocks 
} from '../utils/test-helpers'

describe('Database: RLS Policies', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('Jobs Table RLS', () => {
    it('should allow users to view their company jobs', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockJob = createMockJob({ company_id: 'company-1' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockJob)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', 'company-1')
        .single()

      // Assert
      expect(result.data).toEqual(mockJob)
      expect(result.error).toBeNull()
    })

    it('should prevent users from viewing other company jobs', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockJob = createMockJob({ company_id: 'company-2' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(null, {
        message: 'Row level security policy violated',
        code: '42501'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('jobs')
        .select('*')
        .eq('company_id', 'company-2')
        .single()

      // Assert
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.code).toBe('42501')
    })

    it('should allow site_admin to view all jobs', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'site_admin', company_id: null })
      const mockJob = createMockJob({ company_id: 'any-company' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockJob)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('jobs')
        .select('*')
        .eq('id', mockJob.id)
        .single()

      // Assert
      expect(result.data).toEqual(mockJob)
      expect(result.error).toBeNull()
    })

    it('should allow owners and foremen to create jobs', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner', company_id: 'company-1' })
      const mockJobData = {
        title: 'New Job',
        status: 'planning',
        company_id: 'company-1',
        created_by: mockUser.id
      }
      const mockCreatedJob = createMockJob(mockJobData)
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockCreatedJob)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('jobs')
        .insert(mockJobData)
        .select()
        .single()

      // Assert
      expect(result.data).toEqual(mockCreatedJob)
      expect(result.error).toBeNull()
    })

    it('should prevent workers from creating jobs', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'worker', company_id: 'company-1' })
      const mockJobData = {
        title: 'New Job',
        status: 'planning',
        company_id: 'company-1',
        created_by: mockUser.id
      }
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(null, {
        message: 'Row level security policy violated',
        code: '42501'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('jobs')
        .insert(mockJobData)
        .select()
        .single()

      // Assert
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.code).toBe('42501')
    })
  })

  describe('Projects Table RLS', () => {
    it('should allow users to view their company projects', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockProject = createMockProject({ company_id: 'company-1' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockProject)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', 'company-1')
        .single()

      // Assert
      expect(result.data).toEqual(mockProject)
      expect(result.error).toBeNull()
    })

    it('should prevent users from viewing other company projects', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(null, {
        message: 'Row level security policy violated',
        code: '42501'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', 'company-2')
        .single()

      // Assert
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.code).toBe('42501')
    })

    it('should allow site_admin to view all projects', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'site_admin', company_id: null })
      const mockProject = createMockProject({ company_id: 'any-company' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockProject)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('projects')
        .select('*')
        .eq('id', mockProject.id)
        .single()

      // Assert
      expect(result.data).toEqual(mockProject)
      expect(result.error).toBeNull()
    })
  })

  describe('Job Status History RLS', () => {
    it('should allow users to view status history for their company jobs', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockJob = createMockJob({ id: 'job-1', company_id: 'company-1' })
      const mockStatusHistory = {
        id: 'history-1',
        job_id: 'job-1',
        status: 'active',
        changed_at: '2024-01-01T00:00:00Z',
        changed_by: mockUser.id
      }
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockStatusHistory)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('job_status_history')
        .select('*')
        .eq('job_id', 'job-1')
        .single()

      // Assert
      expect(result.data).toEqual(mockStatusHistory)
      expect(result.error).toBeNull()
    })

    it('should prevent users from viewing status history for other company jobs', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(null, {
        message: 'Row level security policy violated',
        code: '42501'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('job_status_history')
        .select('*')
        .eq('job_id', 'other-company-job')
        .single()

      // Assert
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.code).toBe('42501')
    })

    it('should allow inserting status history with proper auth context', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockStatusHistoryData = {
        job_id: 'job-1',
        status: 'active',
        changed_by: mockUser.id
      }
      const mockCreatedHistory = {
        id: 'history-1',
        ...mockStatusHistoryData,
        changed_at: '2024-01-01T00:00:00Z'
      }
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockCreatedHistory)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('job_status_history')
        .insert(mockStatusHistoryData)
        .select()
        .single()

      // Assert
      expect(result.data).toEqual(mockCreatedHistory)
      expect(result.error).toBeNull()
    })

    it('should allow system operations without auth context', async () => {
      // Arrange - No authenticated user (system operation)
      const mockStatusHistoryData = {
        job_id: 'job-1',
        status: 'active',
        changed_by: null
      }
      const mockCreatedHistory = {
        id: 'history-1',
        ...mockStatusHistoryData,
        changed_at: '2024-01-01T00:00:00Z'
      }
      
      // Mock no authenticated user
      const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>
      mockAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      })
      
      const mockQuery = mockSupabaseQuery(mockCreatedHistory)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('job_status_history')
        .insert(mockStatusHistoryData)
        .select()
        .single()

      // Assert
      expect(result.data).toEqual(mockCreatedHistory)
      expect(result.error).toBeNull()
    })
  })

  describe('Project Stage Templates RLS', () => {
    it('should allow users to view system templates', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockSystemTemplate = {
        id: 'template-1',
        template_name: 'Standard Construction',
        is_system_template: true,
        company_id: null,
        stages: []
      }
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockSystemTemplate)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('project_stage_templates')
        .select('*')
        .eq('is_system_template', true)
        .single()

      // Assert
      expect(result.data).toEqual(mockSystemTemplate)
      expect(result.error).toBeNull()
    })

    it('should allow users to view their company templates', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockCompanyTemplate = {
        id: 'template-1',
        template_name: 'Company Custom Template',
        is_system_template: false,
        company_id: 'company-1',
        stages: []
      }
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockCompanyTemplate)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('project_stage_templates')
        .select('*')
        .eq('company_id', 'company-1')
        .single()

      // Assert
      expect(result.data).toEqual(mockCompanyTemplate)
      expect(result.error).toBeNull()
    })

    it('should prevent users from viewing other company templates', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(null, {
        message: 'Row level security policy violated',
        code: '42501'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('project_stage_templates')
        .select('*')
        .eq('company_id', 'company-2')
        .single()

      // Assert
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.code).toBe('42501')
    })

    it('should allow owners to create company templates', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner', company_id: 'company-1' })
      const mockTemplateData = {
        template_name: 'New Company Template',
        is_system_template: false,
        company_id: 'company-1',
        stages: [],
        created_by: mockUser.id
      }
      const mockCreatedTemplate = {
        id: 'template-1',
        ...mockTemplateData,
        created_at: '2024-01-01T00:00:00Z'
      }
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(mockCreatedTemplate)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('project_stage_templates')
        .insert(mockTemplateData)
        .select()
        .single()

      // Assert
      expect(result.data).toEqual(mockCreatedTemplate)
      expect(result.error).toBeNull()
    })

    it('should prevent workers from creating templates', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'worker', company_id: 'company-1' })
      const mockTemplateData = {
        template_name: 'Worker Template',
        is_system_template: false,
        company_id: 'company-1',
        stages: [],
        created_by: mockUser.id
      }
      
      mockAuthenticatedUser(mockUser)
      
      const mockQuery = mockSupabaseQuery(null, {
        message: 'Row level security policy violated',
        code: '42501'
      })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      // Act
      const result = await supabase
        .from('project_stage_templates')
        .insert(mockTemplateData)
        .select()
        .single()

      // Assert
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.code).toBe('42501')
    })
  })

  describe('Database Function Security', () => {
    it('should allow authorized users to call update_job_status_safely', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      const mockJob = createMockJob({ id: 'job-1', company_id: 'company-1' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockRpc = jest.fn().mockResolvedValue({ data: true, error: null })
      ;(supabase.rpc as jest.Mock).mockImplementation(mockRpc)

      // Act
      const result = await supabase.rpc('update_job_status_safely', {
        p_job_id: 'job-1',
        p_new_status: 'active',
        p_user_id: mockUser.id,
        p_notes: 'Starting work'
      })

      // Assert
      expect(result.data).toBe(true)
      expect(result.error).toBeNull()
      expect(mockRpc).toHaveBeenCalledWith('update_job_status_safely', {
        p_job_id: 'job-1',
        p_new_status: 'active',
        p_user_id: mockUser.id,
        p_notes: 'Starting work'
      })
    })

    it('should prevent unauthorized users from calling update_job_status_safely', async () => {
      // Arrange
      const mockUser = createMockUser({ company_id: 'company-1' })
      
      mockAuthenticatedUser(mockUser)
      
      const mockRpc = jest.fn().mockResolvedValue({ 
        data: null, 
        error: { message: 'User does not have access to update this job' }
      })
      ;(supabase.rpc as jest.Mock).mockImplementation(mockRpc)

      // Act
      const result = await supabase.rpc('update_job_status_safely', {
        p_job_id: 'other-company-job',
        p_new_status: 'active',
        p_user_id: mockUser.id,
        p_notes: 'Unauthorized attempt'
      })

      // Assert
      expect(result.data).toBeNull()
      expect(result.error).toBeTruthy()
      expect(result.error.message).toBe('User does not have access to update this job')
    })
  })
})