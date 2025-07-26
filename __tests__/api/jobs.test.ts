import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/jobs/route'
import { supabase } from '@/lib/supabase'
import { JobStatus } from '@/lib/types'
import { 
  createMockJob, 
  createMockUser, 
  mockSupabaseQuery, 
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  resetMocks 
} from '../utils/test-helpers'

// Mock Next.js request/response
const mockRequest = (params: any = {}) => {
  const url = new URL('http://localhost:3000/api/jobs')
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value as string)
  })
  
  return {
    nextUrl: url,
    headers: {
      get: jest.fn().mockReturnValue('Bearer test-token'),
    },
    json: jest.fn(),
  } as unknown as NextRequest
}

describe('/api/jobs', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('GET /api/jobs', () => {
    it('should return jobs successfully', async () => {
      // Arrange
      const mockJobs = [
        createMockJob({ id: 'job-1', title: 'Job 1' }),
        createMockJob({ id: 'job-2', title: 'Job 2' }),
      ]

      const mockFrom = jest.fn(() => mockSupabaseQuery(mockJobs))
      ;(supabase.from as jest.Mock).mockImplementation(mockFrom)

      const request = mockRequest()

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual({ jobs: mockJobs })
      expect(mockFrom).toHaveBeenCalledWith('jobs')
    })

    it('should filter jobs by company_id', async () => {
      // Arrange
      const mockJobs = [createMockJob({ company_id: 'company-1' })]
      const mockQuery = mockSupabaseQuery(mockJobs)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = mockRequest({ company_id: 'company-1' })

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockQuery.eq).toHaveBeenCalledWith('company_id', 'company-1')
    })

    it('should filter jobs by status', async () => {
      // Arrange
      const mockJobs = [createMockJob({ status: 'active' })]
      const mockQuery = mockSupabaseQuery(mockJobs)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = mockRequest({ status: 'active' })

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockQuery.eq).toHaveBeenCalledWith('status', 'active')
    })

    it('should handle database errors', async () => {
      // Arrange
      const mockQuery = mockSupabaseQuery(null, { message: 'Database error' })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = mockRequest()

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch jobs')
    })

    it('should apply pagination correctly', async () => {
      // Arrange
      const mockJobs = [createMockJob()]
      const mockQuery = mockSupabaseQuery(mockJobs)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = mockRequest({ limit: '10', offset: '20' })

      // Act
      const response = await GET(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockQuery.range).toHaveBeenCalledWith(20, 29) // offset to offset + limit - 1
    })
  })

  describe('POST /api/jobs', () => {
    const mockJobData = {
      title: 'New Job',
      description: 'Job description',
      status: 'planning' as JobStatus,
      start_date: '2024-01-01',
      end_date: '2024-01-31',
      company_id: 'test-company-id',
    }

    it('should create a job successfully', async () => {
      // Arrange
      const mockCreatedJob = createMockJob(mockJobData)
      const mockQuery = mockSupabaseQuery(mockCreatedJob)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = {
        headers: { get: jest.fn().mockReturnValue('Bearer test-token') },
        json: jest.fn().mockResolvedValue(mockJobData),
      } as unknown as NextRequest

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual(mockCreatedJob)
      expect(mockQuery.insert).toHaveBeenCalledWith(mockJobData)
    })

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange
      const request = {
        headers: { get: jest.fn().mockReturnValue(null) },
        json: jest.fn(),
      } as unknown as NextRequest

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should validate foreman assignment', async () => {
      // Arrange
      const mockForeman = createMockUser({ 
        id: 'foreman-id', 
        role: 'foreman', 
        company_id: 'test-company-id' 
      })
      
      const mockQuery = mockSupabaseQuery(mockForeman)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = {
        headers: { get: jest.fn().mockReturnValue('Bearer test-token') },
        json: jest.fn().mockResolvedValue({
          ...mockJobData,
          foreman_id: 'foreman-id',
        }),
      } as unknown as NextRequest

      // Act
      const response = await POST(request)

      // Assert
      expect(response.status).toBe(200)
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'foreman-id')
    })

    it('should reject invalid foreman (wrong role)', async () => {
      // Arrange
      const mockInvalidForeman = createMockUser({ 
        id: 'worker-id', 
        role: 'worker', 
        company_id: 'test-company-id' 
      })
      
      const mockQuery = mockSupabaseQuery(mockInvalidForeman)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = {
        headers: { get: jest.fn().mockReturnValue('Bearer test-token') },
        json: jest.fn().mockResolvedValue({
          ...mockJobData,
          foreman_id: 'worker-id',
        }),
      } as unknown as NextRequest

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Selected user is not a foreman')
    })

    it('should reject foreman from different company', async () => {
      // Arrange
      const mockInvalidForeman = createMockUser({ 
        id: 'foreman-id', 
        role: 'foreman', 
        company_id: 'different-company-id' 
      })
      
      const mockQuery = mockSupabaseQuery(mockInvalidForeman)
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = {
        headers: { get: jest.fn().mockReturnValue('Bearer test-token') },
        json: jest.fn().mockResolvedValue({
          ...mockJobData,
          foreman_id: 'foreman-id',
        }),
      } as unknown as NextRequest

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Foreman must be from the same company')
    })

    it('should handle database insertion errors', async () => {
      // Arrange
      const mockQuery = mockSupabaseQuery(null, { message: 'Insertion failed' })
      ;(supabase.from as jest.Mock).mockReturnValue(mockQuery)

      const request = {
        headers: { get: jest.fn().mockReturnValue('Bearer test-token') },
        json: jest.fn().mockResolvedValue(mockJobData),
      } as unknown as NextRequest

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create job')
    })
  })
})