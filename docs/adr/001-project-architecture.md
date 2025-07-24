# ADR-001: Project Architecture

**Status:** Accepted  
**Date:** 2025-01-24  
**Deciders:** Development Team  
**Technical Story:** Job Tracker Web Application Foundation

## Context

The job tracker web application needs a scalable, maintainable architecture that supports:
- Multi-tenant SaaS platform for construction/field service companies
- Real-time job tracking and worker management
- Mobile-first design for field workers
- Document management and time tracking
- Question-driven job progression system
- Project hierarchy with stages and tasks

Key requirements:
- Must handle multiple companies with isolated data
- Need real-time updates for job status changes
- Require offline-capable mobile interfaces
- Support file uploads and document management
- Integrate with external services (geocoding, notifications)

## Decision

We will implement a **Full-Stack Next.js Architecture** with the following layers:

### Frontend Architecture
- **Next.js 15** with App Router for SSR/SSG capabilities
- **React 19** with TypeScript for type safety
- **Tailwind CSS** for consistent, utility-first styling
- **Radix UI** components for accessible, customizable primitives
- **React Hook Form + Zod** for form validation
- **Zustand** for client-side state management

### Backend Architecture
- **Supabase** as primary backend service providing:
  - PostgreSQL database with Row Level Security (RLS)
  - Real-time subscriptions
  - Authentication and authorization
  - File storage with CDN
  - Edge functions for complex business logic

### Data Layer
- **React Query (@tanstack/react-query)** for server state management
- **Database-first approach** with comprehensive type generation
- **Multi-tenant architecture** using company_id isolation

### Component Architecture
```
src/
├── app/                    # Next.js App Router pages
├── components/            
│   ├── ui/                # Reusable UI components (shadcn/ui pattern)
│   ├── layout/            # Layout components (header, sidebar, etc.)
│   ├── features/          # Feature-specific components
│   └── shared/            # Cross-feature shared components
├── lib/                   # Utilities and configurations
├── hooks/                 # Custom React hooks
├── stores/               # Zustand stores
└── types/                # TypeScript type definitions
```

### Considered Alternatives

1. **Traditional LAMP Stack (PHP/MySQL)**
   - Pros: Familiar, mature ecosystem, lower hosting costs
   - Cons: Less modern development experience, harder real-time features, limited TypeScript

2. **MEAN/MERN Stack (Node.js + MongoDB)**
   - Pros: Full JavaScript, flexible schema, good performance
   - Cons: Need to build authentication, real-time, file storage separately

3. **Chosen: Next.js + Supabase**
   - Pros: Rapid development, built-in auth/storage/real-time, excellent TypeScript support, scalable
   - Cons: Vendor lock-in, potential cold start latency, learning curve

## Consequences

### Positive
- **Rapid Development:** Supabase provides backend services out-of-the-box
- **Type Safety:** End-to-end TypeScript with generated database types
- **Real-time Capabilities:** Built-in subscriptions for live updates
- **Mobile-First:** Responsive design with excellent mobile performance
- **Scalability:** Supabase handles scaling, Next.js provides edge optimization
- **Security:** Row Level Security provides data isolation between companies

### Negative
- **Vendor Lock-in:** Heavy dependence on Supabase ecosystem
- **Complex State Management:** Need to coordinate between React Query, Zustand, and Supabase real-time
- **Learning Curve:** Team needs to understand Supabase RLS policies and PostgreSQL advanced features

### Neutral
- **Cost Structure:** Pay-as-you-scale pricing model
- **Deployment Complexity:** Requires understanding of Vercel/Supabase deployment patterns

## Implementation

### Action Items
- [x] Set up Next.js 15 project with TypeScript
- [x] Configure Supabase connection and authentication
- [x] Implement multi-tenant RLS policies
- [x] Set up React Query for server state management
- [x] Create base UI component library using Radix UI
- [x] Implement Zustand stores for client state
- [ ] Add comprehensive error boundaries
- [ ] Implement offline-first capabilities for mobile

### Database Design Principles
1. **Multi-tenancy:** Every table includes `company_id` with RLS policies
2. **Audit Trail:** All tables include `created_at`, `updated_at`, `created_by`
3. **Soft Deletes:** Use status fields instead of hard deletes where appropriate
4. **Normalized Structure:** Separate concerns (users, workers, jobs, projects, tasks)

## Examples

### Component Pattern
```typescript
// Feature component following our architecture
interface JobDetailsProps {
  jobId: string;
}

export function JobDetails({ jobId }: JobDetailsProps) {
  const { data: job, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJob(jobId)
  });

  if (isLoading) return <Skeleton />;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>{job.title}</CardTitle>
        <JobStatusBadge status={job.status} />
      </CardHeader>
      <CardContent>
        {/* Job details */}
      </CardContent>
    </Card>
  );
}
```

### API Route Pattern
```typescript
// app/api/jobs/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', params.id)
    .single();
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json(data);
}
```

## Compliance

### How to follow this decision
- Use Next.js App Router for all new pages
- Implement RLS policies for all database tables
- Use React Query for all server state
- Follow component composition patterns
- Use TypeScript strict mode throughout

### How to detect violations
- ESLint rules for import patterns
- TypeScript compiler checks
- Database migration reviews for RLS policies
- Code review checklist items

## References

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Multi-tenant Architecture Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---
**Review Date:** 2025-06-01  
**Next Review:** Quarterly architecture review