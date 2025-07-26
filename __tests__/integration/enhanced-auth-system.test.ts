/**
 * Enhanced Authentication System Integration Tests
 * 
 * ADR Phase 3: Infrastructure & Optimization
 * Comprehensive testing of the enhanced authentication system,
 * error handling, and performance monitoring integration.
 */

import { 
  authenticateUser,
  requireCompanyAccess,
  requireAdminAccess,
  requireSiteAdminAccess,
  hasPermission,
  createSuccessResponse,
  createErrorResponse
} from '@/lib/enhanced-auth-helpers'
import { 
  AuthenticationError,
  AuthorizationError,
  DatabaseError
} from '@/lib/error-handler'
import {
  createMockRequest,
  createTestUser,
  createTestCompany,
  createAuthenticatedTestUser,
  cleanupTestData,
  setupBeforeEach,
  teardownAfterEach,
  assertApiResponse,
  parseApiResponse
} from '../utils/enhanced-test-helpers'

// Mock the Supabase client
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn()
    }
  }
}))

// Mock the error logger
jest.mock('@/lib/error-handler', () => ({
  ...jest.requireActual('@/lib/error-handler'),
  errorLogger: {
    logError: jest.fn()
  }
}))

describe('Enhanced Authentication System', () => {
  beforeEach(async () => {
    await setupBeforeEach()
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await teardownAfterEach()
  })

  describe('authenticateUser', () => {
    it('should authenticate valid user successfully', async () => {
      // Arrange
      const testUser = await createAuthenticatedTestUser('worker')
      const mockRequest = createMockRequest('/api/test')
      
      // Mock Supabase responses
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: testUser.id, email: testUser.email } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: testUser.id,
                email: testUser.email,
                full_name: testUser.full_name,
                role: testUser.role,
                company_id: testUser.company_id,
                is_site_admin: testUser.is_site_admin,
                is_active: testUser.is_active,
                last_login_at: testUser.last_login_at
              },
              error: null
            })
          })
        })
      })

      // Also mock the update call for last_login_at
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: testUser,
          error: null
        }),
        update: jest.fn().mockReturnThis()
      })

      // Act
      const result = await authenticateUser(mockRequest)

      // Assert
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user!.id).toBe(testUser.id)
      expect(result.user!.email).toBe(testUser.email)
      expect(result.user!.permissions).toEqual(expect.arrayContaining(['view_assigned_jobs']))
      expect(result.context).toHaveProperty('url')
      expect(result.context).toHaveProperty('method')
    })

    it('should reject invalid authentication token', async () => {
      // Arrange
      const mockRequest = createMockRequest('/api/test')
      const mockSupabase = require('@/lib/supabase').supabase
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      // Act
      const result = await authenticateUser(mockRequest)

      // Assert
      expect(result.user).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error!.status).toBe(401)
      
      const responseBody = await parseApiResponse(result.error!)
      assertApiResponse(responseBody, false)
      expect(responseBody.error.code).toBe('AUTH_FAILED')
    })

    it('should reject inactive user accounts', async () => {
      // Arrange
      const testUser = await createAuthenticatedTestUser('worker', { is_active: false })
      const mockRequest = createMockRequest('/api/test')
      const mockSupabase = require('@/lib/supabase').supabase
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: testUser.id, email: testUser.email } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...testUser, is_active: false },
              error: null
            })
          })
        })
      })

      // Act
      const result = await authenticateUser(mockRequest)

      // Assert
      expect(result.user).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error!.status).toBe(403)
      
      const responseBody = await parseApiResponse(result.error!)
      expect(responseBody.error.code).toBe('ACCOUNT_INACTIVE')
    })

    it('should handle database errors gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest('/api/test')
      const mockSupabase = require('@/lib/supabase').supabase
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'test-id', email: 'test@example.com' } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection failed' }
            })
          })
        })
      })

      // Act
      const result = await authenticateUser(mockRequest)

      // Assert
      expect(result.user).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error!.status).toBe(401)
    })
  })

  describe('requireCompanyAccess', () => {
    it('should allow access to user own company', async () => {
      // Arrange
      const testUser = await createAuthenticatedTestUser('admin')
      const mockRequest = createMockRequest('/api/test')
      
      // Mock authenticateUser to return our test user
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'authenticateUser')
        .mockResolvedValue({
          user: testUser,
          error: null,
          context: { userId: testUser.id, companyId: testUser.company_id }
        })

      // Act
      const result = await requireCompanyAccess(mockRequest, testUser.company_id!)

      // Assert
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user!.id).toBe(testUser.id)
    })

    it('should deny access to different company', async () => {
      // Arrange
      const testUser = await createAuthenticatedTestUser('admin')
      const otherCompanyId = 'other-company-id'
      const mockRequest = createMockRequest('/api/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'authenticateUser')
        .mockResolvedValue({
          user: testUser,
          error: null,
          context: { userId: testUser.id, companyId: testUser.company_id }
        })

      // Act
      const result = await requireCompanyAccess(mockRequest, otherCompanyId)

      // Assert
      expect(result.user).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error!.status).toBe(403)
      
      const responseBody = await parseApiResponse(result.error!)
      expect(responseBody.error.code).toBe('COMPANY_ACCESS_DENIED')
    })

    it('should allow site admin access to any company', async () => {
      // Arrange
      const siteAdmin = await createAuthenticatedTestUser('site_admin', { 
        is_site_admin: true 
      })
      const anyCompanyId = 'any-company-id'
      const mockRequest = createMockRequest('/api/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'authenticateUser')
        .mockResolvedValue({
          user: siteAdmin,
          error: null,
          context: { userId: siteAdmin.id, companyId: siteAdmin.company_id }
        })

      // Act
      const result = await requireCompanyAccess(mockRequest, anyCompanyId)

      // Assert
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user!.is_site_admin).toBe(true)
    })
  })

  describe('requireAdminAccess', () => {
    it('should allow admin access for admin role', async () => {
      // Arrange
      const adminUser = await createAuthenticatedTestUser('admin')
      const mockRequest = createMockRequest('/api/admin/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'requireCompanyAccess')
        .mockResolvedValue({
          user: adminUser,
          error: null,
          context: { userId: adminUser.id, companyId: adminUser.company_id }
        })

      // Act
      const result = await requireAdminAccess(mockRequest, adminUser.company_id!)

      // Assert
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user!.role).toBe('admin')
    })

    it('should allow admin access for owner role', async () => {
      // Arrange
      const ownerUser = await createAuthenticatedTestUser('owner')
      const mockRequest = createMockRequest('/api/admin/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'requireCompanyAccess')
        .mockResolvedValue({
          user: ownerUser,
          error: null,
          context: { userId: ownerUser.id, companyId: ownerUser.company_id }
        })

      // Act
      const result = await requireAdminAccess(mockRequest, ownerUser.company_id!)

      // Assert
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user!.role).toBe('owner')
    })

    it('should deny admin access for worker role', async () => {
      // Arrange
      const workerUser = await createAuthenticatedTestUser('worker')
      const mockRequest = createMockRequest('/api/admin/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'requireCompanyAccess')
        .mockResolvedValue({
          user: workerUser,
          error: null,
          context: { userId: workerUser.id, companyId: workerUser.company_id }
        })

      // Act
      const result = await requireAdminAccess(mockRequest, workerUser.company_id!)

      // Assert
      expect(result.user).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error!.status).toBe(403)
      
      const responseBody = await parseApiResponse(result.error!)
      expect(responseBody.error.code).toBe('ADMIN_ACCESS_REQUIRED')
    })

    it('should allow site admin access regardless of role', async () => {
      // Arrange
      const siteAdmin = await createAuthenticatedTestUser('worker', { 
        is_site_admin: true 
      })
      const mockRequest = createMockRequest('/api/admin/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'requireCompanyAccess')
        .mockResolvedValue({
          user: siteAdmin,
          error: null,
          context: { userId: siteAdmin.id, companyId: siteAdmin.company_id }
        })

      // Act
      const result = await requireAdminAccess(mockRequest, siteAdmin.company_id!)

      // Assert
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user!.is_site_admin).toBe(true)
    })
  })

  describe('requireSiteAdminAccess', () => {
    it('should allow access for site admin', async () => {
      // Arrange
      const siteAdmin = await createAuthenticatedTestUser('site_admin', { 
        is_site_admin: true 
      })
      const mockRequest = createMockRequest('/api/site-admin/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'authenticateUser')
        .mockResolvedValue({
          user: siteAdmin,
          error: null,
          context: { userId: siteAdmin.id, companyId: siteAdmin.company_id }
        })

      // Act
      const result = await requireSiteAdminAccess(mockRequest)

      // Assert
      expect(result.user).not.toBeNull()
      expect(result.error).toBeNull()
      expect(result.user!.is_site_admin).toBe(true)
    })

    it('should deny access for regular admin', async () => {
      // Arrange
      const adminUser = await createAuthenticatedTestUser('admin')
      const mockRequest = createMockRequest('/api/site-admin/test')
      
      jest.spyOn(require('@/lib/enhanced-auth-helpers'), 'authenticateUser')
        .mockResolvedValue({
          user: adminUser,
          error: null,
          context: { userId: adminUser.id, companyId: adminUser.company_id }
        })

      // Act
      const result = await requireSiteAdminAccess(mockRequest)

      // Assert
      expect(result.user).toBeNull()
      expect(result.error).not.toBeNull()
      expect(result.error!.status).toBe(403)
      
      const responseBody = await parseApiResponse(result.error!)
      expect(responseBody.error.code).toBe('SITE_ADMIN_ACCESS_REQUIRED')
    })
  })

  describe('Permission System', () => {
    it('should correctly identify user permissions', () => {
      // Arrange
      const workerUser = {
        permissions: ['view_assigned_jobs', 'update_task_status', 'manage_own_time_entries']
      } as any

      const adminUser = {
        permissions: ['manage_jobs', 'manage_workers', 'assign_tasks', 'view_reports']
      } as any

      // Act & Assert
      expect(hasPermission(workerUser, 'view_assigned_jobs')).toBe(true)
      expect(hasPermission(workerUser, 'manage_jobs')).toBe(false)
      
      expect(hasPermission(adminUser, 'manage_jobs')).toBe(true)
      expect(hasPermission(adminUser, 'manage_company')).toBe(false)
    })

    it('should handle empty permissions array', () => {
      // Arrange
      const userWithNoPermissions = { permissions: [] } as any

      // Act & Assert
      expect(hasPermission(userWithNoPermissions, 'view_assigned_jobs')).toBe(false)
    })
  })

  describe('API Response Utilities', () => {
    it('should create standardized success response', () => {
      // Arrange
      const testData = { id: '123', name: 'Test Item' }
      const message = 'Operation successful'

      // Act
      const response = createSuccessResponse(testData, message)

      // Assert
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(200)
    })

    it('should create standardized error response', () => {
      // Arrange
      const message = 'Operation failed'
      const statusCode = 400
      const code = 'VALIDATION_ERROR'

      // Act
      const response = createErrorResponse(message, statusCode, code, false)

      // Assert
      expect(response).toBeInstanceOf(Response)
      expect(response.status).toBe(statusCode)
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should measure authentication performance', async () => {
      // Arrange
      const testUser = await createAuthenticatedTestUser('worker')
      const mockRequest = createMockRequest('/api/test')
      
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: testUser.id, email: testUser.email } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: testUser,
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnThis()
      })

      // Act
      const startTime = Date.now()
      const result = await authenticateUser(mockRequest)
      const endTime = Date.now()

      // Assert
      expect(result.user).not.toBeNull()
      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second
    })

    it('should handle slow authentication gracefully', async () => {
      // Arrange
      const mockRequest = createMockRequest('/api/test')
      const mockSupabase = require('@/lib/supabase').supabase
      
      // Simulate slow database response
      mockSupabase.auth.getUser.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            data: { user: null },
            error: { message: 'Database timeout' }
          }), 100)
        )
      )

      // Act
      const result = await authenticateUser(mockRequest)

      // Assert
      expect(result.user).toBeNull()
      expect(result.error).not.toBeNull()
    })
  })

  describe('Error Handling Integration', () => {
    it('should log authentication errors', async () => {
      // Arrange
      const mockRequest = createMockRequest('/api/test')
      const mockSupabase = require('@/lib/supabase').supabase
      const mockErrorLogger = require('@/lib/error-handler').errorLogger
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Invalid token' }
      })

      // Act
      await authenticateUser(mockRequest)

      // Assert
      expect(mockErrorLogger.logError).toHaveBeenCalled()
    })

    it('should provide user-friendly error messages', async () => {
      // Arrange
      const mockRequest = createMockRequest('/api/test')
      const mockSupabase = require('@/lib/supabase').supabase
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'jwt_invalid_token' }
      })

      // Act
      const result = await authenticateUser(mockRequest)

      // Assert
      expect(result.error).not.toBeNull()
      const responseBody = await parseApiResponse(result.error!)
      expect(responseBody.error.message).toBe('Authentication failed. Please log in again.')
    })
  })

  describe('Context Extraction', () => {
    it('should extract request context correctly', async () => {
      // Arrange
      const mockRequest = createMockRequest('/api/test', {
        method: 'POST',
        headers: {
          'user-agent': 'Test Browser',
          'x-forwarded-for': '192.168.1.1'
        }
      })

      const testUser = await createAuthenticatedTestUser('worker')
      const mockSupabase = require('@/lib/supabase').supabase
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: testUser.id, email: testUser.email } },
        error: null
      })
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: testUser,
              error: null
            })
          })
        }),
        update: jest.fn().mockReturnThis()
      })

      // Act
      const result = await authenticateUser(mockRequest)

      // Assert
      expect(result.context).toHaveProperty('url', 'http://localhost:3000/api/test')
      expect(result.context).toHaveProperty('method', 'POST')
      expect(result.context).toHaveProperty('userAgent', 'Test Browser')
      expect(result.context).toHaveProperty('ipAddress', '192.168.1.1')
    })
  })
})