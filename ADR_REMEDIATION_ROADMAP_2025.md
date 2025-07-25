# ADR Compliance Remediation Roadmap
**Date:** 2025-01-24  
**Project:** Job Tracking Web Application  
**Timeline:** 6-8 weeks (3 phases)  
**Priority:** Critical - Multi-tenancy and architectural compliance

## Phase 1: Critical Foundation (Weeks 1-3)
*Priority: Immediate - Fixes core architectural and security issues*

### 1.1 Multi-Tenancy Database Foundation ⚠️ CRITICAL
**ADR:** ADR-001, ADR-005  
**Effort:** 2 weeks  
**Assignee:** Senior Backend Developer

#### Tasks:
- [ ] **Create company-scoped tables** (1 week)
  ```sql
  CREATE TABLE company_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL,
    sequence_order INT NOT NULL,
    stage_type TEXT NOT NULL,
    maps_to_status TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
  );
  
  CREATE TABLE company_status_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    status_type TEXT NOT NULL, -- 'job', 'task', 'worker', etc.
    status_key TEXT NOT NULL,
    label TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
  );
  
  CREATE TABLE company_color_schemes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    scheme_type TEXT NOT NULL, -- 'stage', 'status', 'gantt', etc.
    color_key TEXT NOT NULL,
    color_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id)
  );
  ```

- [ ] **Add missing fields to existing tables** (3 days)
  - Add `company_id` to all tables missing it
  - Add audit fields (`created_by`, `updated_at`) where missing
  - Add soft delete columns (`deleted_at`, `is_deleted`)

- [ ] **Implement comprehensive RLS policies** (2 days)
  ```sql
  CREATE POLICY "Users can only access their company's data" 
  ON [table_name] FOR ALL 
  USING (company_id = (
    SELECT company_id 
    FROM users 
    WHERE id = auth.uid()
  ));
  ```

#### Validation Criteria:
- [ ] All tables have `company_id` and proper audit fields
- [ ] RLS policies active and tested on all company-scoped tables
- [ ] Data migration scripts for existing records completed
- [ ] No cross-company data leakage in test scenarios

### 1.2 Hard-Coded Configuration Migration ⚠️ CRITICAL
**ADR:** ADR-005  
**Effort:** 1 week  
**Assignee:** Full-Stack Developer

#### Tasks:
- [ ] **Migrate stage configurations** (2 days)
  - Remove `src/config/stages.ts`
  - Create migration script to populate `company_stages` table
  - Update auto-setup logic to use company-scoped data

- [ ] **Migrate color configurations** (1 day)
  - Remove `src/config/colors.ts`
  - Populate `company_color_schemes` table
  - Create company-specific color lookup functions

- [ ] **Migrate status configurations** (2 days)
  - Remove hard-coded status objects from components
  - Populate `company_status_configs` table
  - Update all components to use dynamic configurations

#### Files to Update:
- `src/components/jobs/job-status-change-form.tsx:25-61`
- `src/components/workers/job-assignments.tsx:46-59`
- `src/components/workers/worker-licenses.tsx:27-48`
- `src/config/constants.ts:12-121`
- `database-scripts/31-seed-initial-stages-data-refactored-safe.sql`

#### Validation Criteria:
- [ ] No hard-coded stage names, colors, or status values in codebase
- [ ] All configuration data loaded dynamically from company-scoped tables
- [ ] Company admin UI can modify all configurations
- [ ] Existing jobs/data maintain functionality after migration

### 1.3 API Security and Authentication ⚠️ CRITICAL  
**ADR:** ADR-003  
**Effort:** 3 days  
**Assignee:** Security-focused Developer

#### Tasks:
- [ ] **Implement environment variable validation** (1 day)
  ```typescript
  // src/lib/env.ts
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY'
  ] as const;

  export function validateEnvironment() {
    const missing = requiredEnvVars.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
  ```

- [ ] **Standardize API authentication** (2 days)
  - Create `hasCompanyAccess()` utility function
  - Update all API routes to use consistent auth pattern:
  ```typescript
  export async function GET(request: NextRequest) {
    const supabase = createRouteHandlerClient();
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = request.nextUrl.searchParams.get('company_id');
    if (!await hasCompanyAccess(user.id, companyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Proceed with request
  }
  ```

#### Files to Update:
- All 65+ API route files in `src/app/api/`
- Create new `src/lib/auth-helpers.ts`
- Update `src/app/layout.tsx` to call `validateEnvironment()`

## Phase 2: Code Quality and Standards (Weeks 3-5)
*Priority: High - Ensures maintainability and consistency*

### 2.1 TypeScript Compliance ⚠️ HIGH
**ADR:** ADR-002, ADR-004  
**Effort:** 1 week  
**Assignee:** Frontend Developer + Code Review

#### Tasks:
- [ ] **Fix TypeScript configuration** (1 day)
  - Remove `ignoreBuildErrors: true` from `next.config.ts`
  - Enable TypeScript strict mode across entire project
  - Fix all existing TypeScript errors

- [ ] **Replace 'any' types** (3 days)
  - `src/lib/types/question-driven.ts`: 35+ instances
  - `src/components/gantt/project-gantt-chart.tsx`: form handlers
  - `src/app/apply/worker/page.tsx`: function parameters
  - `src/components/projects/project-creation-wizard.tsx`: location/form data

- [ ] **Add return type annotations** (1 day)
  - All arrow functions in components
  - Event handlers and utility functions
  - API route handlers

#### Validation Criteria:
- [ ] No `any` types in codebase (except for truly dynamic content)
- [ ] All functions have explicit return types
- [ ] TypeScript build passes with strict mode enabled
- [ ] No TypeScript errors in CI/CD pipeline

### 2.2 File Naming and Structure ⚠️ HIGH
**ADR:** ADR-001, ADR-002  
**Effort:** 2 days  
**Assignee:** Frontend Developer

#### Tasks:
- [ ] **Rename PascalCase component files** (1 day)
  - `FileUploadHandler.tsx` → `file-upload-handler.tsx`
  - `JobDashboard.tsx` → `job-dashboard.tsx`
  - `MobileQuestionInterface.tsx` → `mobile-question-interface.tsx`
  - `MobileTaskList.tsx` → `mobile-task-list.tsx`
  - `StageProgressIndicator.tsx` → `stage-progress-indicator.tsx`
  - Update all import statements

- [ ] **Restructure directories** (1 day)
  - Create `src/components/features/` directory
  - Move feature components: `jobs/`, `workers/`, `time/` → `features/`
  - Create `src/components/shared/` for cross-feature components
  - Move `src/lib/types/` → `src/types/`

#### Directory Structure After Changes:
```
src/
├── app/                    # Next.js App Router (unchanged)
├── components/            
│   ├── ui/                # Base UI components (unchanged)
│   ├── layout/            # Layout components (unchanged)
│   ├── features/          # NEW: Feature-specific components
│   │   ├── jobs/         # Moved from components/jobs/
│   │   ├── workers/      # Moved from components/workers/
│   │   └── time/         # Moved from components/time/
│   └── shared/           # NEW: Cross-feature shared components
├── lib/                   # Utilities and configurations
├── hooks/                 # Custom React hooks
├── stores/               # Zustand stores
└── types/                # NEW: TypeScript type definitions (moved from lib/types/)
```

### 2.3 React Query Implementation ⚠️ HIGH
**ADR:** ADR-001, ADR-004  
**Effort:** 1.5 weeks  
**Assignee:** Frontend Developer

#### Tasks:
- [ ] **Set up React Query provider** (1 day)
  ```typescript
  // src/app/layout.tsx
  import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 3,
      },
    },
  });

  export default function RootLayout({ children }: { children: ReactNode }) {
    return (
      <html>
        <body>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </body>
      </html>
    );
  }
  ```

- [ ] **Replace fetch patterns with React Query** (1 week)
  - `src/components/jobs/enhanced-job-details.tsx`
  - `src/components/workers/assign-worker-form.tsx`
  - All components using `useState + useEffect + fetch`

  ```typescript
  // Before
  const [jobs, setJobs] = useState([]);
  useEffect(() => {
    fetch('/api/jobs').then(res => res.json()).then(setJobs);
  }, []);

  // After
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => fetch('/api/jobs').then(res => res.json())
  });
  ```

- [ ] **Create custom hooks for common queries** (2 days)
  - `useJobs()`, `useWorkers()`, `useCompanyStages()`, etc.
  - Implement mutations for create/update/delete operations

#### Validation Criteria:
- [ ] No direct `fetch` calls in components
- [ ] All server state managed through React Query
- [ ] Proper error handling and loading states
- [ ] Optimistic updates for mutations

## Phase 3: Infrastructure and Optimization (Weeks 5-6)
*Priority: Medium - Enhances reliability and performance*

### 3.1 Database Script Cleanup 🔧 MEDIUM
**ADR:** ADR-003  
**Effort:** 3 days  
**Assignee:** Database Administrator

#### Tasks:
- [ ] **Consolidate duplicate database scripts** (2 days)
  - Remove `-fixed`, `-safe`, `-refactored` variations
  - Establish single source of truth for each migration
  - Implement proper sequential numbering

- [ ] **Add missing npm scripts** (1 day)
  ```json
  {
    "scripts": {
      "db:migrate": "node scripts/run-migration.js",
      "db:seed": "node scripts/seed-database.js",
      "type-check": "tsc --noEmit"
    }
  }
  ```

### 3.2 Code Quality Improvements 🔧 MEDIUM
**ADR:** ADR-002  
**Effort:** 2 days  
**Assignee:** Frontend Developer

#### Tasks:
- [ ] **Fix boolean variable naming** (1 day)
  - `loading` → `isLoading`
  - `active` → `isActive` 
  - `selected` → `isSelected`
  - Update all references

- [ ] **Organize imports consistently** (1 day)
  - Group external libraries, internal components, types
  - Use `@/` path aliases consistently
  - Set up ESLint rules to enforce import order

### 3.3 Documentation and Automation 📚 LOW
**ADR:** All ADRs  
**Effort:** 1 week  
**Assignee:** Tech Lead + DevOps

#### Tasks:
- [ ] **Create automated ADR compliance checks** (3 days)
  - ESLint rules for coding conventions
  - Custom linting for hard-coded configurations
  - Git pre-commit hooks

- [ ] **Update development documentation** (2 days)
  - Code review checklist based on ADRs
  - Onboarding guide for new developers
  - Architecture documentation updates

## Success Metrics and Validation

### Phase 1 Success Criteria:
- [ ] All tables have proper multi-tenancy (company_id + RLS)
- [ ] No hard-coded business logic or configurations
- [ ] All API routes use consistent authentication
- [ ] Environment variables validated at startup

### Phase 2 Success Criteria:
- [ ] TypeScript strict mode passes without errors
- [ ] All components use React Query for server state
- [ ] File naming follows ADR-002 conventions
- [ ] Directory structure matches ADR-001

### Phase 3 Success Criteria:
- [ ] Database scripts follow proper numbering
- [ ] Code quality tools enforce ADR compliance
- [ ] Development workflow includes ADR validation

## Risk Mitigation

### High Risk Items:
1. **Data Migration Risk**
   - **Mitigation:** Backup all data before migrations, test on staging
   - **Rollback Plan:** Keep original hard-coded configurations as backup

2. **Breaking Changes During Refactoring**
   - **Mitigation:** Feature flags for new company-scoped logic
   - **Testing:** Comprehensive integration tests before each phase

3. **Development Velocity Impact**
   - **Mitigation:** Parallel work streams, clear task delegation
   - **Communication:** Daily standups during critical phases

### Resource Requirements:
- **Senior Backend Developer:** 2 weeks (Phase 1)
- **Frontend Developer:** 3 weeks (Phases 2-3)
- **DevOps/Database Administrator:** 1 week (Phase 3)
- **Tech Lead/Project Manager:** Ongoing coordination

## Implementation Notes

### Pre-requisites:
- [ ] Staging environment with full data backup
- [ ] Feature flag system implemented
- [ ] Comprehensive test suite in place
- [ ] Team alignment on ADR compliance importance

### Success Dependencies:
- Management commitment to ADR compliance
- Team availability for focused refactoring work
- Stakeholder acceptance of temporary development slowdown
- Quality assurance resources for testing

---

**Next Actions:**
1. **Get management approval** for 6-8 week refactoring timeline
2. **Assign team members** to each phase
3. **Set up staging environment** for safe testing
4. **Begin Phase 1** with critical multi-tenancy fixes

**Estimated Business Impact:**
- **Cost:** 6-8 weeks development time
- **Benefit:** True multi-tenancy, improved maintainability, reduced technical debt
- **Risk:** Temporary development slowdown, potential bugs during migration
- **Long-term Value:** Scalable SaaS platform ready for growth