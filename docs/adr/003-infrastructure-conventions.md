# ADR-003: Infrastructure Conventions

**Status:** Accepted  
**Date:** 2025-01-24  
**Deciders:** Development Team  
**Technical Story:** Standardize deployment, environment management, and infrastructure practices

## Context

The job tracker application requires consistent infrastructure and deployment practices to ensure:
- Reliable deployments across development, staging, and production environments
- Secure handling of environment variables and secrets
- Consistent database migration and backup strategies
- Monitoring and error tracking across environments
- Scalable hosting and CDN configuration

Current infrastructure includes:
- Next.js application hosted on Vercel
- Supabase for backend services (database, auth, storage)
- Multiple environments (development, staging, production)
- Database migrations and schema management
- File storage and CDN requirements

## Decision

We will adopt the following infrastructure conventions and practices.

### Environment Management

#### Environment Structure
```
Development  → Local development with .env.local
Staging      → Deployed preview branches on Vercel
Production   → Main branch deployment on Vercel
```

#### Environment Variables Pattern
```bash
# .env.local (development)
NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Vercel Environment Variables (staging/production)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
VERCEL_ENV (auto-set by Vercel)
```

#### Environment Variable Conventions
- **Public variables:** Prefix with `NEXT_PUBLIC_` for client-side access
- **Server-only secrets:** No prefix, never expose to client
- **Naming:** Use `SCREAMING_SNAKE_CASE`
- **Validation:** Check required variables at startup

```typescript
// lib/env.ts - Environment variable validation
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

### Database Management

#### Migration Strategy
```bash
# Database scripts organization
database-scripts/
├── 01-complete-database-setup.sql      # Initial schema
├── 02-worker-enhancements.sql          # Feature additions
├── 03-document-management-schema.sql   # New feature schemas
├── 99-clear-database.sql               # Development reset script
└── migrations/                         # Supabase migrations
    ├── 20240101000000_initial_schema.sql
    └── 20240115000000_add_worker_skills.sql
```

#### Database Conventions
- **All tables must include:**
  - `id` (UUID primary key)
  - `company_id` (for multi-tenancy)
  - `created_at` (timestamp with timezone)
  - `updated_at` (timestamp with timezone)
  - `created_by` (user ID reference)

- **Row Level Security (RLS) required on all tables**
- **Soft deletes preferred** over hard deletes for audit trails
- **Foreign key constraints** must be properly defined
- **Indexes** on frequently queried columns

```sql
-- Example table structure
CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status job_status_enum NOT NULL DEFAULT 'draft',
  
  -- Multi-tenant isolation
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Audit fields
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can only access jobs from their company" 
ON jobs FOR ALL 
USING (company_id = get_user_company_id());
```

### Deployment Conventions

#### Vercel Configuration
```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm ci",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        }
      ]
    }
  ]
}
```

#### Build and Deployment Scripts
```json
// package.json scripts
{
  "scripts": {
    "dev": "next dev -H localhost",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "db:migrate": "node scripts/run-migration.js",
    "db:seed": "node scripts/seed-database.js",
    "type-check": "tsc --noEmit"
  }
}
```

#### Deployment Process
1. **Development:** Push to feature branch → Auto-deploy preview on Vercel
2. **Staging:** Merge to staging branch → Deploy to staging environment
3. **Production:** Merge to main branch → Deploy to production

### File Storage and CDN

#### Supabase Storage Structure
```
Storage Buckets:
├── documents/           # Job documents, contracts, photos
│   ├── {company_id}/
│   │   ├── jobs/
│   │   ├── workers/
│   │   └── general/
├── avatars/             # User profile pictures
├── temp-uploads/        # Temporary file storage
└── public-assets/       # Public images, logos
```

#### File Upload Conventions
```typescript
// File upload pattern
const uploadFile = async (file: File, bucket: string, path: string) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data;
};
```

### Monitoring and Error Tracking

#### Error Handling Strategy
```typescript
// Global error boundary for React
export function GlobalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error, errorInfo) => {
        console.error('Global error:', error);
        // Log to monitoring service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// API error logging
export function logApiError(error: Error, context: string) {
  console.error(`API Error in ${context}:`, error);
  // Send to monitoring service in production
}
```

#### Performance Monitoring
- **Next.js built-in analytics** for Core Web Vitals
- **Supabase dashboard** for database performance
- **Vercel Analytics** for deployment and runtime metrics

### Security Conventions

#### Environment Security
- **Never commit** `.env` files to version control
- **Use Vercel environment variables** for production secrets
- **Rotate keys** regularly (quarterly)
- **Principle of least privilege** for API keys

#### API Security
```typescript
// API route authentication pattern
export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient();
  
  // Verify authentication
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify company access
  const companyId = request.nextUrl.searchParams.get('company_id');
  if (!await hasCompanyAccess(user.id, companyId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Proceed with request
}
```

### Considered Alternatives

1. **Self-hosted Infrastructure (AWS/GCP)**
   - Pros: Full control, potentially lower costs at scale
   - Cons: Requires DevOps expertise, maintenance overhead, security management

2. **Traditional Hosting (cPanel/shared hosting)**
   - Pros: Lower initial cost, familiar setup
   - Cons: Poor scalability, limited features, security concerns

3. **Chosen: Vercel + Supabase**
   - Pros: Seamless Next.js deployment, integrated backend services, excellent DX
   - Cons: Vendor lock-in, costs scale with usage

## Consequences

### Positive
- **Automated Deployments:** Git-based workflow with preview deployments
- **Scalable Infrastructure:** Automatic scaling based on traffic
- **Integrated Services:** Seamless connection between frontend and backend
- **Developer Experience:** Easy local development and testing
- **Security:** Built-in security features and best practices

### Negative
- **Vendor Dependencies:** Reliance on Vercel and Supabase
- **Cost Predictability:** Usage-based pricing can be unpredictable
- **Limited Customization:** Less control over underlying infrastructure

### Neutral
- **Learning Curve:** Team needs to understand deployment pipelines
- **Monitoring Setup:** Need to establish monitoring and alerting

## Implementation

### Action Items
- [x] Set up Vercel deployment pipeline
- [x] Configure environment variables in Vercel
- [x] Establish database migration workflow
- [x] Set up Supabase storage buckets
- [ ] Implement error monitoring and alerting
- [ ] Create backup and disaster recovery procedures
- [ ] Document incident response procedures

### Deployment Checklist
```markdown
## Pre-deployment Checklist
- [ ] All tests passing
- [ ] Database migrations applied
- [ ] Environment variables configured
- [ ] Security review completed
- [ ] Performance testing done

## Post-deployment Checklist
- [ ] Application health check
- [ ] Database connectivity verified
- [ ] File upload functionality tested
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented
```

## Examples

### Production Deployment Script
```bash
#!/bin/bash
# scripts/deploy-production.sh

echo "Starting production deployment..."

# Run tests
npm run test
if [ $? -ne 0 ]; then
  echo "Tests failed, aborting deployment"
  exit 1
fi

# Type check
npm run type-check
if [ $? -ne 0 ]; then
  echo "Type check failed, aborting deployment"
  exit 1
fi

# Build
npm run build
if [ $? -ne 0 ]; then
  echo "Build failed, aborting deployment"
  exit 1
fi

echo "Deployment ready for Vercel"
```

### Database Migration Runner
```javascript
// scripts/run-migration.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function runMigration(filename) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const sql = fs.readFileSync(`database-scripts/${filename}`, 'utf8');
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error(`Migration ${filename} failed:`, error);
    process.exit(1);
  }
  
  console.log(`Migration ${filename} completed successfully`);
}
```

## Compliance

### How to follow this decision
- Use environment variables for all configuration
- Apply database migrations through scripts
- Follow Git workflow for deployments
- Implement proper error handling in all API routes
- Use Supabase RLS for data security

### How to detect violations
- Environment variable validation at startup
- Automated tests for API security
- Code review checklist for infrastructure changes
- Monitoring alerts for deployment failures

## References

- [Vercel Deployment Documentation](https://vercel.com/docs/deployments)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [Next.js Deployment Best Practices](https://nextjs.org/docs/deployment)
- [Database Migration Best Practices](https://supabase.com/docs/guides/cli/local-development)

---
**Review Date:** 2025-07-01  
**Next Review:** When infrastructure issues arise or major changes are needed