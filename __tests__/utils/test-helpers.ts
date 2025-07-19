import { supabase } from '@/lib/supabase'
import { User, Job, Project } from '@/lib/types'

// Mock data generators
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  role: 'owner',
  company_id: 'test-company-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockJob = (overrides?: Partial<Job>): Job => ({
  id: 'test-job-id',
  title: 'Test Job',
  description: 'Test job description',
  status: 'planning',
  start_date: new Date().toISOString(),
  end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  budget: 10000,
  client_name: 'Test Client',
  location: 'Test Location',
  project_id: null,
  project_stage_id: null,
  is_standalone: true,
  company_id: 'test-company-id',
  created_by: 'test-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const createMockProject = (overrides?: Partial<Project>): Project => ({
  id: 'test-project-id',
  name: 'Test Project',
  description: 'Test project description',
  status: 'planning',
  client_name: 'Test Client',
  site_address: 'Test Address',
  planned_start_date: new Date().toISOString().split('T')[0],
  planned_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  total_budget: 50000,
  company_id: 'test-company-id',
  created_by: 'test-user-id',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

// Database test helpers
export const mockSupabaseResponse = (data: any, error: any = null) => {
  return jest.fn().mockResolvedValue({ data, error })
}

export const mockSupabaseQuery = (mockData: any, error: any = null) => {
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: mockData, error }),
  }
  return mockChain
}

// API test helpers
export const mockFetch = (response: any, status: number = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(response),
  })
}

export const mockApiResponse = (data: any, status: number = 200) => {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
  }
}

// Authentication helpers
export const mockAuthenticatedUser = (user?: Partial<User>) => {
  const mockUser = createMockUser(user)
  const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>
  mockAuth.getUser.mockResolvedValue({
    data: { user: mockUser as any },
    error: null,
  })
  return mockUser
}

export const mockUnauthenticatedUser = () => {
  const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>
  mockAuth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  })
}

// Test database state
export const resetMocks = () => {
  jest.clearAllMocks()
}

// Custom matchers for better test readability
export const expectJobToHaveStatus = (job: Job, expectedStatus: string) => {
  expect(job.status).toBe(expectedStatus)
}

export const expectJobToBeStandalone = (job: Job) => {
  expect(job.is_standalone).toBe(true)
  expect(job.project_id).toBeNull()
  expect(job.project_stage_id).toBeNull()
}

export const expectJobToBeInProject = (job: Job, projectId: string) => {
  expect(job.is_standalone).toBe(false)
  expect(job.project_id).toBe(projectId)
}

// Wait for async operations
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Test environment setup
export const setupTestDatabase = () => {
  // In a real implementation, this would set up a test database
  // For now, we'll just ensure mocks are properly configured
  resetMocks()
}

export const teardownTestDatabase = () => {
  // Clean up after tests
  resetMocks()
}

// Test to ensure helpers work correctly
describe('Test Helpers', () => {
  it('should create mock data correctly', () => {
    const mockUser = createMockUser()
    const mockJob = createMockJob()
    const mockProject = createMockProject()

    expect(mockUser.id).toBe('test-user-id')
    expect(mockJob.id).toBe('test-job-id')
    expect(mockProject.id).toBe('test-project-id')
  })

  it('should handle overrides correctly', () => {
    const mockUser = createMockUser({ role: 'worker' })
    const mockJob = createMockJob({ status: 'active' })
    const mockProject = createMockProject({ status: 'active' })

    expect(mockUser.role).toBe('worker')
    expect(mockJob.status).toBe('active')
    expect(mockProject.status).toBe('active')
  })
})