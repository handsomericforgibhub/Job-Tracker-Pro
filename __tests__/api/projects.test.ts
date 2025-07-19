import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/projects/route'
import { supabase } from '@/lib/supabase'
import { 
  createMockProject, 
  createMockUser, 
  mockSupabaseQuery, 
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  resetMocks 
} from '../utils/test-helpers'

// Mock Next.js request/response
const mockRequest = (params: any = {}, body: any = {}) => {
  const url = new URL('http://localhost:3000/api/projects')
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value as string)
  })
  
  return {
    nextUrl: url,
    headers: {
      get: jest.fn().mockReturnValue('Bearer test-token'),
    },
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe('/api/projects', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('GET /api/projects', () => {
    it('should return projects successfully', async () => {
      // Arrange
      const mockUser = createMockUser()
      const mockProjects = [
        createMockProject({ id: 'project-1', name: 'Project 1' }),
        createMockProject({ id: 'project-2', name: 'Project 2' }),
      ]

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectsQuery = mockSupabaseQuery(mockProjects)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery) // User info fetch
        .mockReturnValueOnce(mockProjectsQuery) // Projects fetch

      const request = mockRequest()

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual(mockProjects)
    })

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange
      mockUnauthenticatedUser()
      const request = mockRequest()

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should filter projects by company for regular users', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner', company_id: 'company-1' })
      const mockProjects = [createMockProject({ company_id: 'company-1' })]

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectsQuery = mockSupabaseQuery(mockProjects)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectsQuery)

      const request = mockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockProjectsQuery.eq).toHaveBeenCalledWith('company_id', 'company-1')
    })

    it('should allow site_admin to view all projects', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'site_admin', company_id: null })
      const mockProjects = [
        createMockProject({ company_id: 'company-1' }),
        createMockProject({ company_id: 'company-2' }),
      ]

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectsQuery = mockSupabaseQuery(mockProjects)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectsQuery)

      const request = mockRequest()

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual(mockProjects)
      // Should not filter by company_id for site_admin
      expect(mockProjectsQuery.eq).not.toHaveBeenCalledWith('company_id', expect.anything())
    })

    it('should include project statistics when requested', async () => {
      // Arrange
      const mockUser = createMockUser()
      const mockProjects = [createMockProject({ id: 'project-1' })]
      const mockSummary = [{
        total_stages: 5,
        completed_stages: 2,
        total_jobs: 10,
        completed_jobs: 3,
        overall_completion: 40,
        estimated_hours: 100,
        actual_hours: 40
      }]

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectsQuery = mockSupabaseQuery(mockProjects)
      const mockSummaryQuery = mockSupabaseQuery(mockSummary)
      const mockWorkersQuery = mockSupabaseQuery(null, null, 5) // count: 5 workers
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectsQuery)
        .mockReturnValueOnce(mockWorkersQuery)
      ;(supabase.rpc as jest.Mock).mockReturnValue(mockSummaryQuery)

      const request = mockRequest({ include_stats: 'true' })

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data[0]).toMatchObject({
        id: 'project-1',
        total_stages: 5,
        completed_stages: 2,
        active_workers: 5,
      })
    })

    it('should filter projects by status', async () => {
      // Arrange
      const mockUser = createMockUser()
      const mockProjects = [createMockProject({ status: 'active' })]

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectsQuery = mockSupabaseQuery(mockProjects)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectsQuery)

      const request = mockRequest({ status: 'active' })

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockProjectsQuery.eq).toHaveBeenCalledWith('status', 'active')
    })

    it('should apply pagination correctly', async () => {
      // Arrange
      const mockUser = createMockUser()
      const mockProjects = [createMockProject()]

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectsQuery = mockSupabaseQuery(mockProjects)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectsQuery)

      const request = mockRequest({ limit: '10', offset: '20' })

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockProjectsQuery.range).toHaveBeenCalledWith(20, 29)
    })
  })

  describe('POST /api/projects', () => {
    const mockProjectData = {
      name: 'New Project',
      description: 'Project description',
      client_name: 'Test Client',
      site_address: 'Test Address',
      planned_start_date: '2024-01-01',
      planned_end_date: '2024-12-31',
      total_budget: 100000,
    }

    it('should create a project successfully', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner' })
      const mockCreatedProject = createMockProject(mockProjectData)

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectQuery = mockSupabaseQuery(mockCreatedProject)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectQuery)

      const request = mockRequest({}, mockProjectData)

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(201)
      expect(data).toEqual(mockCreatedProject)
      expect(mockProjectQuery.insert).toHaveBeenCalledWith({
        ...mockProjectData,
        company_id: mockUser.company_id,
        created_by: mockUser.id,
      })
    })

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange
      mockUnauthenticatedUser()
      const request = mockRequest({}, mockProjectData)

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 403 for workers (insufficient permissions)', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'worker' })
      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      ;(supabase.from as jest.Mock).mockReturnValue(mockUserQuery)

      const request = mockRequest({}, mockProjectData)

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data.error).toBe('Insufficient permissions')
    })

    it('should validate project manager assignment', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner' })
      const mockProjectManager = createMockUser({ 
        id: 'pm-id', 
        role: 'foreman', 
        company_id: mockUser.company_id 
      })
      const mockCreatedProject = createMockProject({
        ...mockProjectData,
        project_manager_id: 'pm-id'
      })

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockManagerQuery = mockSupabaseQuery(mockProjectManager)
      const mockProjectQuery = mockSupabaseQuery(mockCreatedProject)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockManagerQuery)
        .mockReturnValueOnce(mockProjectQuery)

      const request = mockRequest({}, {
        ...mockProjectData,
        project_manager_id: 'pm-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockManagerQuery.eq).toHaveBeenCalledWith('id', 'pm-id')
    })

    it('should reject invalid project manager (different company)', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner', company_id: 'company-1' })
      const mockProjectManager = createMockUser({ 
        id: 'pm-id', 
        role: 'foreman', 
        company_id: 'company-2' // Different company
      })

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockManagerQuery = mockSupabaseQuery(mockProjectManager)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockManagerQuery)

      const request = mockRequest({}, {
        ...mockProjectData,
        project_manager_id: 'pm-id'
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid project manager')
    })

    it('should allow site_admin to create projects for any company', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'site_admin', company_id: null })
      const mockCreatedProject = createMockProject({
        ...mockProjectData,
        company_id: 'target-company-id'
      })

      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectQuery = mockSupabaseQuery(mockCreatedProject)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectQuery)

      const request = mockRequest({}, {
        ...mockProjectData,
        company_id: 'target-company-id'
      })

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(201)
      expect(mockProjectQuery.insert).toHaveBeenCalledWith({
        ...mockProjectData,
        company_id: 'target-company-id',
        created_by: mockUser.id,
      })
    })

    it('should handle database insertion errors', async () => {
      // Arrange
      const mockUser = createMockUser({ role: 'owner' })
      mockAuthenticatedUser(mockUser)
      
      const mockUserQuery = mockSupabaseQuery(mockUser)
      const mockProjectQuery = mockSupabaseQuery(null, { message: 'Database error' })
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockUserQuery)
        .mockReturnValueOnce(mockProjectQuery)

      const request = mockRequest({}, mockProjectData)

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create project')
    })
  })
})