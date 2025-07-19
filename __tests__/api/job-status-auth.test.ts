import { NextRequest } from 'next/server'
import { POST } from '@/app/api/jobs/[id]/status-history/route'
import { createClient } from '@supabase/supabase-js'

// Mock the supabase client
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

// Mock the main supabase import
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}))

describe('Job Status API Authentication', () => {
  const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>
  const mockSupabaseAdmin = {
    auth: {
      getUser: jest.fn()
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreateClient.mockReturnValue(mockSupabaseAdmin as any)
  })

  const mockRequest = (authHeader: string | null, body: any) => {
    const headers = new Headers()
    if (authHeader) {
      headers.set('authorization', authHeader)
    }
    headers.set('content-type', 'application/json')
    
    return {
      headers,
      json: jest.fn().mockResolvedValue(body)
    } as unknown as NextRequest
  }

  const mockParams = (id: string) => Promise.resolve({ id })

  it('should return 401 when no authorization header is provided', async () => {
    // Arrange
    const request = mockRequest(null, { status: 'active' })

    // Act
    const response = await POST(request, { params: mockParams('test-job-id') })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 401 when token is invalid', async () => {
    // Arrange
    const request = mockRequest('Bearer invalid-token', { status: 'active' })
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' }
    })

    // Act
    const response = await POST(request, { params: mockParams('test-job-id') })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
    expect(mockSupabaseAdmin.auth.getUser).toHaveBeenCalledWith('invalid-token')
  })

  it('should proceed with valid token and user', async () => {
    // Arrange
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const request = mockRequest('Bearer valid-token', { status: 'active' })
    
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Mock the job lookup to return a job (this will make the test continue)
    const { supabase } = require('@/lib/supabase')
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { status: 'planning' },
            error: null
          })
        })
      })
    })

    // Mock the RPC call to return success
    supabase.rpc.mockResolvedValue({
      data: true,
      error: null
    })

    // Act
    const response = await POST(request, { params: mockParams('test-job-id') })

    // Assert
    expect(mockSupabaseAdmin.auth.getUser).toHaveBeenCalledWith('valid-token')
    expect(response.status).not.toBe(401) // Should not be unauthorized
  })

  it('should validate status parameter', async () => {
    // Arrange
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const request = mockRequest('Bearer valid-token', { status: 'invalid_status' })
    
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Act
    const response = await POST(request, { params: mockParams('test-job-id') })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Invalid status')
  })

  it('should check if job exists before updating', async () => {
    // Arrange
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const request = mockRequest('Bearer valid-token', { status: 'active' })
    
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Mock job not found
    const { supabase } = require('@/lib/supabase')
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Job not found' }
          })
        })
      })
    })

    // Act
    const response = await POST(request, { params: mockParams('nonexistent-job') })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(404)
    expect(data.error).toBe('Job not found')
  })

  it('should prevent updating to the same status', async () => {
    // Arrange
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const request = mockRequest('Bearer valid-token', { status: 'active' })
    
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Mock job with same status
    const { supabase } = require('@/lib/supabase')
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { status: 'active' }, // Same status as request
            error: null
          })
        })
      })
    })

    // Act
    const response = await POST(request, { params: mockParams('test-job-id') })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(400)
    expect(data.error).toBe('Status is already set to this value')
  })

  it('should call update_job_status_safely with correct parameters', async () => {
    // Arrange
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const request = mockRequest('Bearer valid-token', { 
      status: 'active',
      notes: 'Test notes' 
    })
    
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Mock job with different status
    const { supabase } = require('@/lib/supabase')
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { status: 'planning' },
            error: null
          })
        })
      })
    })

    // Mock successful RPC call
    supabase.rpc.mockResolvedValue({
      data: true,
      error: null
    })

    // Act
    const response = await POST(request, { params: mockParams('test-job-id') })

    // Assert
    expect(supabase.rpc).toHaveBeenCalledWith('update_job_status_safely', {
      p_job_id: 'test-job-id',
      p_new_status: 'active',
      p_user_id: 'user-123',
      p_notes: 'Test notes'
    })
    expect(response.status).toBe(200)
  })

  it('should handle RPC errors', async () => {
    // Arrange
    const mockUser = { id: 'user-123', email: 'test@example.com' }
    const request = mockRequest('Bearer valid-token', { status: 'active' })
    
    mockSupabaseAdmin.auth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null
    })

    // Mock job with different status
    const { supabase } = require('@/lib/supabase')
    supabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { status: 'planning' },
            error: null
          })
        })
      })
    })

    // Mock RPC failure
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC failed' }
    })

    // Act
    const response = await POST(request, { params: mockParams('test-job-id') })
    const data = await response.json()

    // Assert
    expect(response.status).toBe(500)
    expect(data.error).toContain('Failed to update job status')
  })
})