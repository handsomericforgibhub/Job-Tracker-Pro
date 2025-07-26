import { NextRequest } from 'next/server'
import { GET, POST } from '@/app/api/jobs/[id]/status-history/route'
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

// Mock Next.js request/response with params
const mockRequest = (body: any = {}) => {
  return {
    json: jest.fn().mockResolvedValue(body),
    headers: {
      get: jest.fn().mockReturnValue('Bearer test-token'),
    },
  } as unknown as NextRequest
}

const mockParams = (id: string) => Promise.resolve({ id })

describe('/api/jobs/[id]/status-history', () => {
  beforeEach(() => {
    resetMocks()
  })

  describe('GET /api/jobs/[id]/status-history', () => {
    it('should return job status history successfully', async () => {
      // Arrange
      const jobId = 'test-job-id'
      const mockJob = createMockJob({ id: jobId })
      const mockStatusHistory = [
        {
          id: 'history-1',
          status: 'planning',
          changed_at: '2024-01-01T00:00:00Z',
          notes: 'Initial status',
          changed_by: 'user-1',
        },
        {
          id: 'history-2',
          status: 'active',
          changed_at: '2024-01-02T00:00:00Z',
          notes: 'Started work',
          changed_by: 'user-1',
        },
      ]

      const mockJobQuery = mockSupabaseQuery(mockJob)
      const mockHistoryQuery = mockSupabaseQuery(mockStatusHistory)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockJobQuery) // First call for job verification
        .mockReturnValueOnce(mockHistoryQuery) // Second call for status history

      const request = mockRequest()

      // Act
      const response = await GET(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.job_id).toBe(jobId)
      expect(data.history).toHaveLength(2)
      expect(data.history[0].status).toBe('planning')
      expect(data.history[1].status).toBe('active')
      expect(data.history[1].is_current).toBe(true)
    })

    it('should return 404 for non-existent job', async () => {
      // Arrange
      const jobId = 'non-existent-job'
      const mockJobQuery = mockSupabaseQuery(null, { message: 'Job not found' })
      ;(supabase.from as jest.Mock).mockReturnValue(mockJobQuery)

      const request = mockRequest()

      // Act
      const response = await GET(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toBe('Job not found')
    })

    it('should create demo status history when none exists', async () => {
      // Arrange
      const jobId = 'test-job-id'
      const mockJob = createMockJob({ 
        id: jobId, 
        status: 'active',
        start_date: '2024-01-01',
        end_date: '2024-01-31' 
      })
      
      const mockJobQuery = mockSupabaseQuery(mockJob)
      const mockEmptyHistoryQuery = mockSupabaseQuery([]) // No history exists
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockJobQuery)
        .mockReturnValueOnce(mockEmptyHistoryQuery)

      const request = mockRequest()

      // Act
      const response = await GET(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.history).toHaveLength(3) // Demo entries: planning -> active -> current
      expect(data.history[0].status).toBe('planning')
      expect(data.history[2].status).toBe('active')
    })

    it('should calculate duration correctly', async () => {
      // Arrange
      const jobId = 'test-job-id'
      const mockJob = createMockJob({ id: jobId })
      const mockStatusHistory = [
        {
          id: 'history-1',
          status: 'planning',
          changed_at: '2024-01-01T00:00:00Z',
          notes: 'Initial status',
          changed_by: 'user-1',
        },
        {
          id: 'history-2',
          status: 'active',
          changed_at: '2024-01-05T00:00:00Z', // 4 days later
          notes: 'Started work',
          changed_by: 'user-1',
        },
      ]

      const mockJobQuery = mockSupabaseQuery(mockJob)
      const mockHistoryQuery = mockSupabaseQuery(mockStatusHistory)
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockJobQuery)
        .mockReturnValueOnce(mockHistoryQuery)

      const request = mockRequest()

      // Act
      const response = await GET(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.history[0].duration_days).toBe(4)
      expect(data.history[1].is_current).toBe(true)
    })
  })

  describe('POST /api/jobs/[id]/status-history', () => {
    const jobId = 'test-job-id'

    it('should update job status successfully', async () => {
      // Arrange
      const newStatus = 'active'
      const notes = 'Starting work'
      const mockUser = createMockUser()
      const mockJob = createMockJob({ id: jobId, status: 'planning' })
      const mockUpdatedJob = createMockJob({ id: jobId, status: newStatus })

      mockAuthenticatedUser(mockUser)
      
      const mockJobQuery = mockSupabaseQuery(mockJob)
      const mockUpdatedJobQuery = mockSupabaseQuery(mockUpdatedJob)
      const mockRpcQuery = mockSupabaseQuery(true) // update_job_status_safely returns true
      
      ;(supabase.from as jest.Mock)
        .mockReturnValueOnce(mockJobQuery) // Job verification
        .mockReturnValueOnce(mockUpdatedJobQuery) // Updated job fetch
      ;(supabase.rpc as jest.Mock).mockReturnValue(mockRpcQuery)

      const request = mockRequest({ status: newStatus, notes })

      // Act
      const response = await POST(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.job_id).toBe(jobId)
      expect(data.new_status).toBe(newStatus)
      expect(data.notes).toBe(notes)
      expect(supabase.rpc).toHaveBeenCalledWith('update_job_status_safely', {
        p_job_id: jobId,
        p_new_status: newStatus,
        p_user_id: mockUser.id,
        p_notes: notes,
      })
    })

    it('should return 401 for unauthenticated requests', async () => {
      // Arrange
      mockUnauthenticatedUser()
      const request = mockRequest({ status: 'active' })

      // Act
      const response = await POST(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 for invalid status', async () => {
      // Arrange
      const invalidStatus = 'invalid_status'
      mockAuthenticatedUser()
      const request = mockRequest({ status: invalidStatus })

      // Act
      const response = await POST(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid status')
    })

    it('should return 404 for non-existent job', async () => {
      // Arrange
      const nonExistentJobId = 'non-existent-job'
      mockAuthenticatedUser()
      
      const mockJobQuery = mockSupabaseQuery(null, { message: 'Job not found' })
      ;(supabase.from as jest.Mock).mockReturnValue(mockJobQuery)

      const request = mockRequest({ status: 'active' })

      // Act
      const response = await POST(request, { params: mockParams(nonExistentJobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(404)
      expect(data.error).toBe('Job not found')
    })

    it('should return 400 when status is not changing', async () => {
      // Arrange
      const currentStatus = 'active'
      mockAuthenticatedUser()
      
      const mockJob = createMockJob({ id: jobId, status: currentStatus })
      const mockJobQuery = mockSupabaseQuery(mockJob)
      ;(supabase.from as jest.Mock).mockReturnValue(mockJobQuery)

      const request = mockRequest({ status: currentStatus })

      // Act
      const response = await POST(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Status is already set to this value')
    })

    it('should handle database update errors', async () => {
      // Arrange
      const newStatus = 'active'
      mockAuthenticatedUser()
      
      const mockJob = createMockJob({ id: jobId, status: 'planning' })
      const mockJobQuery = mockSupabaseQuery(mockJob)
      const mockRpcQuery = mockSupabaseQuery(null, { message: 'Database update failed' })
      
      ;(supabase.from as jest.Mock).mockReturnValue(mockJobQuery)
      ;(supabase.rpc as jest.Mock).mockReturnValue(mockRpcQuery)

      const request = mockRequest({ status: newStatus })

      // Act
      const response = await POST(request, { params: mockParams(jobId) })
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to update job status')
    })

    it('should test all valid status transitions', async () => {
      // Arrange
      const validStatuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled']
      mockAuthenticatedUser()
      
      for (const status of validStatuses) {
        const mockJob = createMockJob({ id: jobId, status: 'planning' })
        const mockUpdatedJob = createMockJob({ id: jobId, status: status as JobStatus })
        
        const mockJobQuery = mockSupabaseQuery(mockJob)
        const mockUpdatedJobQuery = mockSupabaseQuery(mockUpdatedJob)
        const mockRpcQuery = mockSupabaseQuery(true)
        
        ;(supabase.from as jest.Mock)
          .mockReturnValueOnce(mockJobQuery)
          .mockReturnValueOnce(mockUpdatedJobQuery)
        ;(supabase.rpc as jest.Mock).mockReturnValue(mockRpcQuery)

        const request = mockRequest({ status })

        // Act
        const response = await POST(request, { params: mockParams(jobId) })
        const data = await response.json()

        // Assert
        expect(response.status).toBe(200)
        expect(data.new_status).toBe(status)
        
        // Reset mocks for next iteration
        jest.clearAllMocks()
        mockAuthenticatedUser()
      }
    })
  })
})