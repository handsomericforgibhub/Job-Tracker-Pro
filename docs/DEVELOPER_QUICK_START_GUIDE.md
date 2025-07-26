# Developer Quick Start Guide - Multi-Tenant JobTracker

**Last Updated:** Phase 3 Complete (2025-07-25)  
**Current Version:** v3.0 - Infrastructure & Optimization Implementation  
**Next Update:** Production Deployment & Monitoring

---

## 🎯 **Overview**

JobTracker is now a **true multi-tenant SaaS application** with complete data isolation between companies. This guide shows you how to work with the new architecture.

## 🏗️ **Architecture Overview**

### **Multi-Tenancy Model**
- Every table has a `company_id` field
- Row Level Security (RLS) enforces data isolation
- Company-specific configurations stored in database
- No hard-coded business logic

### **Key Components**
- **Authentication:** Standardized API security with company access validation
- **Configuration:** Dynamic, company-scoped stages, colors, and status configs
- **Database:** RLS policies ensure data isolation
- **Environment:** Startup validation prevents misconfiguration

---

## 🔐 **Authentication & Security**

### **Using Auth Helpers in API Routes**

```typescript
// src/app/api/jobs/route.ts
import { requireCompanyAccess, createSuccessResponse, createErrorResponse } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  // 1. Authenticate user and validate company access
  const { user, error } = await requireCompanyAccess(request)
  
  if (error) {
    return error // Returns proper 401/403 response
  }

  // 2. Use authenticated user's company_id (never trust client)
  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('company_id', user.company_id) // RLS will also enforce this
    
  return createSuccessResponse(jobs)
}
```

### **Available Auth Functions**

| Function | Use Case |
|----------|----------|
| `requireAuthentication(request)` | Basic user authentication |
| `requireCompanyAccess(request, companyId?)` | Company-scoped access validation |
| `requireAdminAccess(request)` | Company admin or site admin only |
| `requireSiteAdminAccess(request)` | Site admin only |
| `hasCompanyAccess(user, companyId)` | Check if user can access company |
| `isAdmin(user)` | Check if user has admin privileges |

### **Error Handling**

```typescript
// Standard error responses
return createErrorResponse('Job not found', 404, 'JOB_NOT_FOUND')

// Standard success responses  
return createSuccessResponse(data, 'Jobs retrieved successfully')
```

---

## 🎨 **Company-Scoped Configurations**

### **Using Dynamic Stages**

**❌ Before (Hard-coded):**
```typescript
// Don't do this anymore
import { STAGE_DEFINITIONS } from '@/config/stages'
const stageName = STAGE_DEFINITIONS[stageId].name
```

**✅ After (Company-scoped):**
```typescript
// Get stages from database
const { data: stages } = await supabase
  .rpc('get_company_stage_definitions', { p_company_id: user.company_id })

// Or use helper function in database
const { data: defaultStage } = await supabase
  .rpc('get_company_default_stage', { p_company_id: user.company_id })
```

### **Using Dynamic Colors**

**❌ Before (Hard-coded):**
```typescript
import { getStageColor } from '@/config/colors'
const color = getStageColor(stageName)
```

**✅ After (Company-scoped):**
```typescript
// Get colors from database
const { data: color } = await supabase
  .rpc('get_company_stage_color', { 
    p_company_id: user.company_id,
    p_stage_name: stageName 
  })

// Or get entire color scheme
const { data: colors } = await supabase
  .rpc('get_company_colors', { 
    p_company_id: user.company_id,
    p_scheme_type: 'stage' 
  })
```

### **Using Dynamic Status Configurations**

**❌ Before (Hard-coded):**
```typescript
const statusConfig = {
  planning: { label: 'Planning', color: 'blue' }
  // ... hard-coded configs
}
```

**✅ After (Company-scoped):**
```typescript
// Get status configurations from database
const { data: statusConfigs } = await supabase
  .rpc('get_company_status_configs_by_type', {
    p_company_id: user.company_id,
    p_status_type: 'job'
  })

// Get single status config
const { data: config } = await supabase
  .rpc('get_company_status_config', {
    p_company_id: user.company_id,
    p_status_type: 'job',
    p_status_key: 'planning'
  })
```

---

## 💾 **Database Helpers**

### **Available Database Functions**

| Function | Purpose |
|----------|---------|
| `get_company_stage_definitions(company_id)` | Get all stages for a company |
| `get_company_default_stage(company_id)` | Get first stage for a company |
| `get_company_stage_color(company_id, stage_name)` | Get color for a stage |
| `get_company_status_configs_by_type(company_id, type)` | Get status configs by type |
| `get_company_chart_colors(company_id)` | Get chart color palette |
| `get_status_config_for_api(company_id, type)` | Get configs as JSON for API |

### **RLS Policy Functions**

| Function | Purpose |
|----------|---------|
| `get_user_company_id()` | Get current user's company_id |
| `is_site_admin()` | Check if current user is site admin |
| `has_company_access(company_id)` | Check if user can access company |

---

## 🔧 **Using React Query Hooks**

### Jobs Management
```typescript
import { 
  useJobsQuery, 
  useJobQuery, 
  useCreateJobMutation, 
  useUpdateJobMutation,
  useUpdateJobStatusMutation 
} from '@/hooks/use-jobs-query'

// Fetch all jobs
const { data: jobs, isLoading, error } = useJobsQuery()

// Fetch single job
const { data: job } = useJobQuery(jobId)

// Create new job
const createJobMutation = useCreateJobMutation()
await createJobMutation.mutateAsync(jobData)

// Update job status
const updateStatusMutation = useUpdateJobStatusMutation()
await updateStatusMutation.mutateAsync({ 
  id: jobId, 
  status: 'active', 
  notes: 'Started work today' 
})
```

### Workers Management
```typescript
import { 
  useWorkersQuery, 
  useWorkerQuery, 
  useAvailableWorkersQuery,
  useCreateWorkerMutation 
} from '@/hooks/use-workers-query'

// Fetch all workers
const { data: workers } = useWorkersQuery()

// Fetch available workers for assignment
const { data: availableWorkers } = useAvailableWorkersQuery(jobId)

// Create new worker
const createWorkerMutation = useCreateWorkerMutation()
await createWorkerMutation.mutateAsync(workerData)
```

### Query Cache Management
```typescript
import { useQueryClient } from '@tanstack/react-query'
import { jobsQueryKeys } from '@/hooks/use-jobs-query'

const queryClient = useQueryClient()

// Invalidate specific queries
queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() })

// Prefetch data for performance
const prefetchJob = usePrefetchJob()
prefetchJob(jobId) // Prefetch on hover or navigation
```

---

## 🛠️ **Development Patterns**

### **Creating New API Routes**

```typescript
// Template for new API routes
import { requireCompanyAccess, createSuccessResponse, createErrorResponse, logApiAccess } from '@/lib/auth-helpers'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate and validate company access
    const { user, error } = await requireCompanyAccess(request)
    if (error) return error

    // 2. Query with user's company_id (RLS will enforce isolation)
    const { data, error: dbError } = await supabase
      .from('your_table')
      .select('*')
      .eq('company_id', user.company_id)

    if (dbError) {
      logApiAccess(request, user, 'fetch_data', false, dbError.message)
      return createErrorResponse('Failed to fetch data', 500)
    }

    // 3. Log success and return standardized response
    logApiAccess(request, user, 'fetch_data', true)
    return createSuccessResponse(data)
  } catch (error) {
    logApiAccess(request, null, 'fetch_data', false, error.message)
    return createErrorResponse('Internal server error', 500)
  }
}
```

### **Creating New Database Tables**

```sql
-- Always include these fields for multi-tenancy
CREATE TABLE your_new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Your table fields here
  name TEXT NOT NULL,
  description TEXT,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- Always add these for performance and security
CREATE INDEX idx_your_table_company_id ON your_new_table(company_id);
ALTER TABLE your_new_table ENABLE ROW LEVEL SECURITY;

-- Add RLS policy
CREATE POLICY "company_access_policy" ON your_new_table
  FOR ALL USING (has_company_access(company_id));
```

### **Working with Company Configurations**

```typescript
// Component that uses dynamic configurations
export function JobStatusBadge({ job, user }: { job: Job, user: AuthenticatedUser }) {
  const [statusConfig, setStatusConfig] = useState(null)
  
  useEffect(() => {
    // Load company-specific status configuration
    const loadConfig = async () => {
      const { data } = await supabase
        .rpc('get_company_status_config', {
          p_company_id: user.company_id,
          p_status_type: 'job',
          p_status_key: job.status
        })
      setStatusConfig(data[0])
    }
    loadConfig()
  }, [job.status, user.company_id])
  
  if (!statusConfig) return <Skeleton />
  
  return (
    <Badge 
      style={{ backgroundColor: statusConfig.color }}
      className={statusConfig.className}
    >
      {statusConfig.label}
    </Badge>
  )
}
```

---

## 🌍 **Environment Configuration**

### **Required Environment Variables**

```bash
# Required - App will not start without these
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Recommended
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENVIRONMENT=development
LOG_LEVEL=info
```

### **Environment Validation**

The app automatically validates environment variables at startup. Check the console for:
- ✅ Environment validation passed
- ⚠️ Environment warnings (missing optional vars)
- ❌ Environment validation failed (missing required vars)

---

## 🧪 **Testing**

### **Testing Multi-Tenancy**

```typescript
// Test that users can only access their company's data
describe('Multi-tenancy', () => {
  it('should only return jobs for user company', async () => {
    const user1 = await createTestUser({ company_id: 'company-1' })
    const user2 = await createTestUser({ company_id: 'company-2' })
    
    // Create job for company 1
    const job = await createTestJob({ company_id: 'company-1' })
    
    // User 1 should see the job
    const response1 = await apiCall('/api/jobs', user1)
    expect(response1.data).toContain(job)
    
    // User 2 should NOT see the job
    const response2 = await apiCall('/api/jobs', user2)
    expect(response2.data).not.toContain(job)
  })
})
```

### **Testing Company Configurations**

```typescript
// Test company-specific configurations
it('should use company-specific stage colors', async () => {
  const company1 = await createTestCompany()
  const company2 = await createTestCompany()
  
  // Set different colors for same stage
  await setCompanyStageColor(company1.id, 'planning', '#FF0000')
  await setCompanyStageColor(company2.id, 'planning', '#00FF00')
  
  const color1 = await getCompanyStageColor(company1.id, 'planning')
  const color2 = await getCompanyStageColor(company2.id, 'planning')
  
  expect(color1).toBe('#FF0000')
  expect(color2).toBe('#00FF00')
})
```

---

## 🚨 **Common Pitfalls**

### **❌ Don't Trust Client Data**
```typescript
// BAD - Trusting client-provided company_id
const company_id = request.body.company_id // ❌ Can be spoofed

// GOOD - Use authenticated user's company_id
const { user } = await requireCompanyAccess(request)
const company_id = user.company_id // ✅ Verified by auth system
```

### **❌ Don't Bypass RLS**
```typescript
// BAD - Manual company filtering (can be forgotten)
const jobs = await supabase.from('jobs').select('*').eq('company_id', companyId)

// GOOD - Let RLS handle it (more secure)
const jobs = await supabase.from('jobs').select('*') // RLS automatically filters
```

### **❌ Don't Hard-Code Configurations**
```typescript
// BAD - Hard-coded business logic
if (job.status === 'planning') { // ❌ What if company customizes statuses?

// GOOD - Use dynamic configurations
const statusConfig = await getCompanyStatusConfig(user.company_id, 'job', job.status)
if (statusConfig.status_key === 'planning') { // ✅ Respects company customization
```

---

## 🎯 **Migration Checklist**

When updating existing code to use the new multi-tenant architecture:

### **API Routes**
- [ ] Replace manual auth with `requireCompanyAccess()`
- [ ] Use `user.company_id` instead of client-provided company_id
- [ ] Replace manual error responses with `createErrorResponse()`
- [ ] Add `logApiAccess()` for security monitoring
- [ ] Test that RLS policies work correctly

### **Components**
- [ ] Replace hard-coded configurations with database calls
- [ ] Use company-scoped color/status/stage helpers
- [ ] Add proper loading states for dynamic configs
- [ ] Test with different company configurations

### **Database**
- [ ] Ensure all new tables have `company_id` field
- [ ] Enable RLS on all company-scoped tables
- [ ] Add proper RLS policies using helper functions
- [ ] Add performance indexes on `company_id` columns

---

## 🔄 **Phase 2 Improvements**

**✅ Phase 2: Code Quality & Standards Complete**

### React Query Implementation
```typescript
// OLD: Manual fetch with useState/useEffect
const [jobs, setJobs] = useState([])
const [loading, setLoading] = useState(true)

useEffect(() => {
  fetch('/api/jobs').then(res => res.json()).then(setJobs)
}, [])

// NEW: React Query hooks
import { useJobsQuery } from '@/hooks/use-jobs-query'

const { data: jobs, isLoading: loading, error } = useJobsQuery()
```

### Modern Directory Structure
```
src/
├── components/
│   ├── features/          # Feature-specific components
│   │   ├── jobs/         # Job management components
│   │   ├── workers/      # Worker management components
│   │   ├── projects/     # Project components
│   │   └── ...
│   ├── shared/           # Reusable components
│   │   ├── layout/       # Layout components
│   │   ├── qr/          # QR code components
│   │   └── signature/    # Signature components
│   └── ui/              # Base UI components
├── hooks/               # React Query hooks
│   ├── use-jobs-query.ts
│   └── use-workers-query.ts
└── providers/           # Context providers
    └── query-provider.tsx
```

### TypeScript Strict Mode
- All `any` types replaced with specific interfaces
- Strict null checks enabled
- Build errors now fail the build process
- Proper type exports for consistent typing

### File Naming Standards
- All components use kebab-case: `JobDashboard.tsx` → `job-dashboard.tsx`
- Consistent import paths across the application
- ADR-compliant file organization

## 📊 **Phase 3 Improvements**

**✅ Phase 3: Infrastructure & Optimization Complete**

### Consolidated Database Migrations
```bash
# Clean, numbered migration system
npm run db:migrate              # Run all pending migrations
npm run db:migrate:dry-run      # Preview migrations
npm run db:reset               # Reset and rebuild database
```

### Enhanced Error Handling & Logging
```typescript
// Comprehensive error handling with categorization
import { 
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  BusinessLogicError,
  errorLogger 
} from '@/lib/error-handler'

// Automatic error logging and categorization
try {
  await riskyOperation()
} catch (error) {
  await errorLogger.logError(error, {
    context: 'user_operation',
    userId: user.id,
    companyId: user.company_id
  })
  throw error
}
```

### Performance Monitoring
```typescript
// Automatic performance tracking
import { 
  withPerformanceMonitoring,
  performanceMonitor,
  MetricType
} from '@/lib/performance-monitor'

// Monitor function performance
const monitoredFunction = withPerformanceMonitoring(
  myFunction,
  MetricType.API_RESPONSE_TIME,
  'my_operation'
)

// Record custom metrics
await performanceMonitor.recordMetric({
  metric_type: MetricType.DATABASE_QUERY,
  metric_name: 'complex_query',
  duration_ms: 250,
  company_id: user.company_id
})
```

### Enhanced Authentication System
```typescript
// Enhanced auth with comprehensive error handling
import { 
  requireCompanyAccess,
  requireAdminAccess,
  hasPermission,
  createSuccessResponse,
  logApiAccess
} from '@/lib/enhanced-auth-helpers'

export async function GET(request: NextRequest) {
  // Authentication with performance monitoring
  const authResult = await requireCompanyAccess(request)
  if (authResult.error) return authResult.error
  
  const { user } = authResult
  
  // Permission-based access control
  if (!hasPermission(user, 'view_jobs')) {
    return createErrorResponse('Insufficient permissions', 403)
  }
  
  // Enhanced API access logging
  await logApiAccess(request, user, 'GET /api/jobs', true)
  
  return createSuccessResponse(data)
}
```

### Comprehensive Testing Suite
```typescript
// Enhanced test utilities
import {
  createTestUser,
  createTestJob,
  createAuthenticatedTestUser,
  measureExecutionTime,
  assertApiResponse
} from '@/__tests__/utils/enhanced-test-helpers'

// Performance testing
const { result, duration } = await measureExecutionTime(
  () => complexOperation(),
  1000 // Max 1 second
)

// Multi-tenancy testing
await testDataIsolation('jobs', company1Id, company2Id)
```

### Documentation Automation
```bash
# Generate comprehensive API documentation
npm run docs:generate          # Generate API docs
npm run docs:build            # Build complete documentation

# Output:
# - docs/api/routes.md         # API endpoint documentation
# - docs/api/types.md          # TypeScript type definitions
# - docs/api/openapi.json      # OpenAPI specification
# - docs/api/README.md         # Documentation summary
```

### Consolidated Database Structure
```
database-scripts/consolidated/
├── 01-core-database-setup.sql           # Companies, users, RLS
├── 02-company-configuration-tables.sql  # Dynamic configs
├── 03-core-business-tables.sql          # Jobs, workers, projects
├── 04-error-logging-system.sql          # Error tracking
└── README.md                            # Migration guide
```

## 🎯 **What's Coming Next**

**Production Deployment & Monitoring** will add:
- Production environment setup
- CI/CD pipeline configuration
- Real-time monitoring dashboards
- Backup and disaster recovery
- Security hardening
- Load testing and optimization

**This guide will be updated** as each phase completes to include new patterns and best practices.

---

## 🆘 **Need Help?**

### **Quick References**
- **Auth Functions:** `src/lib/auth-helpers.ts`
- **Environment Config:** `src/lib/env.ts`  
- **Database Helpers:** Check database script comments
- **Implementation Details:** `PHASE_1_COMPLETION_SUMMARY.md`

### **Debugging**
- Check console for environment validation messages
- Use `logApiAccess()` to track security events
- Test RLS policies work in Supabase SQL editor
- Verify company_id fields exist on all relevant tables

### **Architecture Questions**
- Review ADR documents in `docs/adr/` folder
- Check `ADR_REMEDIATION_ROADMAP_2025.md` for overall plan
- Reference individual database scripts for implementation details

---

**Happy coding!** 🚀

*This guide will be continuously updated as we progress through Phases 2 and 3.*