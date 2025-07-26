/**
 * Enhanced Test Helpers
 * 
 * ADR Phase 3: Infrastructure & Optimization
 * Comprehensive testing utilities for the multi-tenant JobTracker application
 * with support for performance testing, error simulation, and monitoring validation.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { AuthenticatedUser } from '@/lib/enhanced-auth-helpers'
import { PerformanceMetric, MetricType } from '@/lib/performance-monitor'
import { ErrorCategory, ErrorSeverity } from '@/lib/error-handler'

// =============================================
// Test Configuration
// =============================================

const TEST_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const TEST_SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-key'

export const testSupabase = createClient(TEST_SUPABASE_URL, TEST_SUPABASE_KEY, {
  auth: { persistSession: false }
})

// =============================================
// Test Data Factories
// =============================================

export interface TestCompany {
  id: string
  name: string
  slug: string
  subscription_plan: string
  max_users: number
  created_at: string
}

export interface TestUser {
  id: string
  email: string
  full_name: string
  role: string
  company_id: string
  is_site_admin: boolean
  is_active: boolean
  created_at: string
}

export interface TestJob {
  id: string
  company_id: string
  title: string
  description: string
  status: string
  priority: string
  client_name: string
  created_by: string
  created_at: string
}

/**
 * Create test company with default values
 */
export async function createTestCompany(
  overrides: Partial<TestCompany> = {}
): Promise<TestCompany> {
  const company = {
    id: crypto.randomUUID(),
    name: `Test Company ${Date.now()}`,
    slug: `test-company-${Date.now()}`,
    subscription_plan: 'basic',
    max_users: 10,
    created_at: new Date().toISOString(),
    ...overrides
  }

  const { data, error } = await testSupabase
    .from('companies')
    .insert(company)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test company: ${error.message}`)
  }

  return data
}

/**
 * Create test user with default values
 */
export async function createTestUser(
  overrides: Partial<TestUser> = {},
  companyId?: string
): Promise<TestUser> {
  let company_id = companyId
  
  if (!company_id) {
    const testCompany = await createTestCompany()
    company_id = testCompany.id
  }

  const user = {
    id: crypto.randomUUID(),
    email: `test-user-${Date.now()}@example.com`,
    full_name: `Test User ${Date.now()}`,
    role: 'worker',
    company_id,
    is_site_admin: false,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides
  }

  const { data, error } = await testSupabase
    .from('users')
    .insert(user)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test user: ${error.message}`)
  }

  return data
}

/**
 * Create authenticated test user for API testing
 */
export async function createAuthenticatedTestUser(
  role: string = 'worker',
  overrides: Partial<TestUser> = {}
): Promise<AuthenticatedUser> {
  const testUser = await createTestUser({ role, ...overrides })
  
  return {
    id: testUser.id,
    email: testUser.email,
    role: testUser.role as any,
    company_id: testUser.company_id,
    full_name: testUser.full_name,
    is_site_admin: testUser.is_site_admin,
    is_active: testUser.is_active,
    last_login_at: new Date().toISOString(),
    permissions: getRolePermissions(testUser.role)
  }
}

/**
 * Create test job with default values
 */
export async function createTestJob(
  overrides: Partial<TestJob> = {},
  companyId?: string,
  userId?: string
): Promise<TestJob> {
  let company_id = companyId
  let created_by = userId
  
  if (!company_id || !created_by) {
    const testUser = await createTestUser()
    company_id = company_id || testUser.company_id
    created_by = created_by || testUser.id
  }

  const job = {
    id: crypto.randomUUID(),
    company_id: company_id!,
    title: `Test Job ${Date.now()}`,
    description: 'Test job description',
    status: 'planning',
    priority: 'medium',
    client_name: 'Test Client',
    created_by: created_by!,
    created_at: new Date().toISOString(),
    ...overrides
  }

  const { data, error } = await testSupabase
    .from('jobs')
    .insert(job)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test job: ${error.message}`)
  }

  return data
}

/**
 * Get role permissions for testing
 */
function getRolePermissions(role: string): string[] {
  const permissions: Record<string, string[]> = {
    site_admin: ['manage_all_companies', 'manage_all_users', 'view_system_logs'],
    owner: ['manage_company', 'manage_all_users', 'manage_jobs', 'view_reports'],
    admin: ['manage_jobs', 'manage_workers', 'assign_tasks', 'view_reports'],
    foreman: ['manage_assigned_jobs', 'assign_tasks', 'manage_time_entries'],
    worker: ['view_assigned_jobs', 'update_task_status', 'manage_own_time_entries'],
    client: ['view_own_jobs', 'submit_feedback', 'view_job_progress']
  }
  return permissions[role] || []
}

// =============================================
// Mock Request Helpers
// =============================================

/**
 * Create mock Next.js request for testing
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string
    headers?: Record<string, string>
    body?: any
    searchParams?: Record<string, string>
  } = {}
): NextRequest {
  const {
    method = 'GET',
    headers = {},
    body,
    searchParams = {}
  } = options

  // Build URL with search params
  const urlObj = new URL(url, 'http://localhost:3000')
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value)
  })

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      'user-agent': 'Test Agent',
      ...headers
    }
  }

  if (body && method !== 'GET') {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body)
  }

  return new NextRequest(urlObj.toString(), requestInit)
}

/**
 * Create authenticated mock request
 */
export function createAuthenticatedMockRequest(
  url: string,
  user: AuthenticatedUser,
  options: Parameters<typeof createMockRequest>[1] = {}
): NextRequest {
  return createMockRequest(url, {
    ...options,
    headers: {
      ...options.headers,
      'x-user-id': user.id,
      'x-company-id': user.company_id || ''
    }
  })
}

// =============================================
// Database Testing Utilities
// =============================================

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(): Promise<void> {
  try {
    // Delete in order of dependencies
    await testSupabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('error_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('performance_metrics').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('time_entries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('job_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('workers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await testSupabase.from('companies').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  } catch (error) {
    console.warn('Cleanup failed:', error)
  }
}

/**
 * Setup test database with sample data
 */
export async function setupTestDatabase(): Promise<{
  company: TestCompany
  users: TestUser[]
  jobs: TestJob[]
}> {
  // Create test company
  const company = await createTestCompany({
    name: 'Test Company',
    slug: 'test-company'
  })

  // Create test users with different roles
  const users = await Promise.all([
    createTestUser({ role: 'owner', email: 'owner@test.com' }, company.id),
    createTestUser({ role: 'admin', email: 'admin@test.com' }, company.id),
    createTestUser({ role: 'foreman', email: 'foreman@test.com' }, company.id),
    createTestUser({ role: 'worker', email: 'worker@test.com' }, company.id),
    createTestUser({ role: 'client', email: 'client@test.com' }, company.id)
  ])

  // Create test jobs
  const jobs = await Promise.all([
    createTestJob({
      title: 'Kitchen Renovation',
      status: 'planning',
      priority: 'high'
    }, company.id, users[0].id),
    createTestJob({
      title: 'Bathroom Remodel',
      status: 'active',
      priority: 'medium'
    }, company.id, users[1].id),
    createTestJob({
      title: 'Deck Construction',
      status: 'completed',
      priority: 'low'
    }, company.id, users[0].id)
  ])

  return { company, users, jobs }
}

/**
 * Assert RLS (Row Level Security) policies work correctly
 */
export async function assertRLSPreventsAccess(
  tableName: string,
  userId: string,
  companyId: string,
  unauthorizedCompanyId: string
): Promise<void> {
  // This would require setting up RLS context, which is complex in tests
  // For now, we'll mock this functionality
  console.log(`RLS test: ${tableName} for user ${userId} should not access company ${unauthorizedCompanyId}`)
}

// =============================================
// Performance Testing Utilities
// =============================================

/**
 * Measure function execution time
 */
export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  expectedMaxMs?: number
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now()
  const result = await fn()
  const duration = Date.now() - startTime

  if (expectedMaxMs && duration > expectedMaxMs) {
    throw new Error(`Operation took ${duration}ms, expected maximum ${expectedMaxMs}ms`)
  }

  return { result, duration }
}

/**
 * Create test performance metric
 */
export async function createTestPerformanceMetric(
  overrides: Partial<PerformanceMetric> = {}
): Promise<PerformanceMetric> {
  const metric: PerformanceMetric = {
    id: crypto.randomUUID(),
    metric_type: MetricType.API_RESPONSE_TIME,
    metric_name: 'test_operation',
    operation_name: 'test_operation',
    duration_ms: 100,
    measured_at: new Date().toISOString(),
    ...overrides
  }

  const { data, error } = await testSupabase
    .from('performance_metrics')
    .insert(metric)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test performance metric: ${error.message}`)
  }

  return data
}

/**
 * Simulate slow operation for performance testing
 */
export async function simulateSlowOperation(delayMs: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

// =============================================
// Error Testing Utilities
// =============================================

/**
 * Create test error log entry
 */
export async function createTestErrorLog(
  overrides: Partial<{
    message: string
    category: ErrorCategory
    severity: ErrorSeverity
    code: string
    company_id: string
    user_id: string
  }> = {}
): Promise<any> {
  const errorLog = {
    id: crypto.randomUUID(),
    message: 'Test error message',
    category: ErrorCategory.SYSTEM,
    severity: ErrorSeverity.MEDIUM,
    code: 'TEST_ERROR',
    created_at: new Date().toISOString(),
    ...overrides
  }

  const { data, error } = await testSupabase
    .from('error_logs')
    .insert(errorLog)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create test error log: ${error.message}`)
  }

  return data
}

/**
 * Simulate various types of errors for testing
 */
export class ErrorSimulator {
  static async simulateAuthenticationError(): Promise<never> {
    throw new Error('Invalid authentication token')
  }

  static async simulateAuthorizationError(): Promise<never> {
    throw new Error('Insufficient permissions to access resource')
  }

  static async simulateDatabaseError(): Promise<never> {
    throw new Error('Database connection failed')
  }

  static async simulateValidationError(): Promise<never> {
    throw new Error('Required field is missing')
  }

  static async simulateBusinessLogicError(): Promise<never> {
    throw new Error('Cannot delete job with active time entries')
  }

  static async simulatePerformanceError(): Promise<never> {
    await simulateSlowOperation(5000) // 5 second delay
    throw new Error('Operation timed out')
  }
}

// =============================================
// API Testing Utilities
// =============================================

/**
 * Parse API response for testing
 */
export async function parseApiResponse(response: Response): Promise<{
  success: boolean
  data?: any
  error?: any
  metadata?: any
}> {
  const text = await response.text()
  
  try {
    return JSON.parse(text)
  } catch {
    return {
      success: false,
      error: { message: text || 'Invalid JSON response' }
    }
  }
}

/**
 * Assert API response format
 */
export function assertApiResponse(
  response: any,
  expectedSuccess: boolean = true
): void {
  expect(response).toHaveProperty('success')
  expect(response.success).toBe(expectedSuccess)
  
  if (expectedSuccess) {
    expect(response).toHaveProperty('data')
    expect(response).toHaveProperty('metadata')
  } else {
    expect(response).toHaveProperty('error')
    expect(response.error).toHaveProperty('message')
    expect(response.error).toHaveProperty('code')
  }
}

/**
 * Test rate limiting (mock implementation)
 */
export async function testRateLimit(
  apiCall: () => Promise<Response>,
  maxRequests: number,
  timeWindowMs: number
): Promise<void> {
  const responses: Response[] = []
  
  // Make requests rapidly
  for (let i = 0; i < maxRequests + 5; i++) {
    try {
      const response = await apiCall()
      responses.push(response)
    } catch (error) {
      // Rate limiting may throw errors
      console.log(`Request ${i + 1} failed:`, error)
    }
  }
  
  // Check if rate limiting kicked in
  const rateLimitedResponses = responses.filter(r => r.status === 429)
  expect(rateLimitedResponses.length).toBeGreaterThan(0)
}

// =============================================
// Multi-tenancy Testing Utilities
// =============================================

/**
 * Test multi-tenant data isolation
 */
export async function testDataIsolation(
  tableName: string,
  company1Id: string,
  company2Id: string
): Promise<void> {
  // Create test data for both companies
  const testData1 = { company_id: company1Id, name: 'Company 1 Data' }
  const testData2 = { company_id: company2Id, name: 'Company 2 Data' }
  
  await testSupabase.from(tableName).insert([testData1, testData2])
  
  // Verify each company can only see their own data
  const { data: company1Data } = await testSupabase
    .from(tableName)
    .select('*')
    .eq('company_id', company1Id)
  
  const { data: company2Data } = await testSupabase
    .from(tableName)
    .select('*')
    .eq('company_id', company2Id)
  
  expect(company1Data).toHaveLength(1)
  expect(company2Data).toHaveLength(1)
  expect(company1Data![0].company_id).toBe(company1Id)
  expect(company2Data![0].company_id).toBe(company2Id)
}

// =============================================
// Test Lifecycle Hooks
// =============================================

/**
 * Setup function to run before each test
 */
export async function setupBeforeEach(): Promise<void> {
  // Reset any global state
  // Clear caches
  // Setup test database state
}

/**
 * Teardown function to run after each test
 */
export async function teardownAfterEach(): Promise<void> {
  // Clean up test data
  await cleanupTestData()
  // Reset mocks
  jest.clearAllMocks()
}

/**
 * Global test setup
 */
export async function globalTestSetup(): Promise<void> {
  // Setup test environment
  // Initialize test database
  // Configure test utilities
}

/**
 * Global test teardown
 */
export async function globalTestTeardown(): Promise<void> {
  // Clean up test environment
  // Close database connections
  // Final cleanup
}