# ADR-004: Technology Stack

**Status:** Accepted  
**Date:** 2025-01-24  
**Deciders:** Development Team  
**Technical Story:** Define the complete technology stack and rationale for each choice

## Context

The job tracker application requires a modern, scalable technology stack that supports:
- Multi-tenant SaaS architecture for construction/field service companies
- Real-time collaboration and updates
- Mobile-first responsive design
- Complex business logic and workflows
- File upload and document management
- Offline capabilities for field workers
- Integration with external services (maps, notifications, etc.)

The technology choices must balance:
- Developer productivity and experience
- Application performance and scalability
- Long-term maintainability
- Team expertise and learning curve
- Cost considerations
- Vendor ecosystem and support

## Decision

We will use the following technology stack, organized by layer and purpose.

### Frontend Stack

#### Core Framework
**Next.js 15** with App Router
- **Rationale:** Full-stack React framework with excellent TypeScript support, built-in optimization, and seamless deployment
- **Alternatives considered:** Create React App (limited), Vite + React (no SSR), Remix (smaller ecosystem)
- **Key benefits:** SSR/SSG, API routes, image optimization, automatic code splitting

#### UI Framework and Styling
**React 19** + **TypeScript 5**
- **Rationale:** Latest React with concurrent features, comprehensive TypeScript integration
- **Key benefits:** Improved performance, better type safety, modern React patterns

**Tailwind CSS 4** + **Radix UI** + **shadcn/ui**
- **Rationale:** Utility-first CSS with accessible, unstyled components and pre-built component library
- **Alternatives considered:** Material-UI (opinionated design), Chakra UI (bundle size), styled-components (runtime cost)
- **Key benefits:** Design consistency, accessibility, customizable, smaller bundle size

```typescript
// Component example using our UI stack
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function JobCard({ job }: { job: Job }) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {job.title}
          <Button variant="outline" size="sm">
            Edit
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{job.description}</p>
      </CardContent>
    </Card>
  );
}
```

#### State Management
**Zustand** for client state + **React Query** for server state
- **Rationale:** Simple, TypeScript-friendly client state with powerful server state management
- **Alternatives considered:** Redux Toolkit (complexity), Context API (performance), SWR (fewer features)
- **Key benefits:** Minimal boilerplate, excellent TypeScript support, automatic caching and synchronization

```typescript
// Zustand store example
interface AuthState {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  signIn: async (email, password) => {
    set({ isLoading: true });
    // Implementation
  },
  signOut: async () => {
    // Implementation
  }
}));

// React Query usage
const { data: jobs, isLoading } = useQuery({
  queryKey: ['jobs', { status: 'active' }],
  queryFn: () => fetchJobs({ status: 'active' }),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

#### Form Handling
**React Hook Form** + **Zod**
- **Rationale:** Performant forms with TypeScript schema validation
- **Alternatives considered:** Formik (performance issues), native forms (no validation)
- **Key benefits:** Minimal re-renders, schema-based validation, excellent TypeScript integration

```typescript
// Form schema and usage
const jobSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'completed']),
});

type JobFormData = z.infer<typeof jobSchema>;

export function JobForm() {
  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: '',
      status: 'draft',
    }
  });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* Form fields */}
    </form>
  );
}
```

### Backend Stack

#### Backend-as-a-Service
**Supabase** (PostgreSQL + Real-time + Auth + Storage)
- **Rationale:** Complete backend service with excellent PostgreSQL support and real-time capabilities
- **Alternatives considered:** Firebase (NoSQL limitations), AWS Amplify (complexity), custom Node.js (maintenance)
- **Key benefits:** PostgreSQL with full SQL features, real-time subscriptions, built-in auth, file storage

#### Database
**PostgreSQL 15** via Supabase
- **Rationale:** ACID compliance, advanced features (JSON, arrays, full-text search), excellent performance
- **Key benefits:** Row Level Security, triggers, functions, mature ecosystem

```sql
-- Example RLS policy for multi-tenancy
CREATE POLICY "Users can only access their company's jobs" 
ON jobs FOR ALL 
USING (company_id = (
  SELECT company_id 
  FROM users 
  WHERE id = auth.uid()
));
```

#### Authentication & Authorization
**Supabase Auth** + **Row Level Security**
- **Rationale:** OAuth providers, secure session management, database-level security
- **Key benefits:** Multiple auth providers, automatic JWT handling, granular permissions

#### File Storage
**Supabase Storage** with CDN
- **Rationale:** Integrated with auth system, automatic image optimization, global CDN
- **Key benefits:** Secure uploads, image transformations, integration with database

### Development Tools

#### Code Quality
**ESLint** + **Prettier** + **TypeScript strict mode**
- **Configuration:** Next.js + TypeScript preset with custom rules
- **Benefits:** Consistent code style, catch errors early, automated formatting

#### Testing
**Jest** + **React Testing Library**
- **Rationale:** Industry standard, good Next.js integration, focuses on user behavior
- **Coverage:** Unit tests for utilities, integration tests for components, API route testing

```typescript
// Example test
import { render, screen } from '@testing-library/react';
import { JobCard } from '../job-card';

test('renders job title and description', () => {
  const mockJob = {
    id: '1',
    title: 'Test Job',
    description: 'Test Description',
    status: 'active' as const
  };

  render(<JobCard job={mockJob} />);
  
  expect(screen.getByText('Test Job')).toBeInTheDocument();
  expect(screen.getByText('Test Description')).toBeInTheDocument();
});
```

#### Package Management
**npm** with package-lock.json
- **Rationale:** Default Node.js package manager, reliable, well-supported
- **Alternatives considered:** yarn (complexity), pnpm (team familiarity)

### External Integrations

#### Maps and Geocoding
**Geoapify Geocoder Autocomplete**
- **Rationale:** Good free tier, accurate geocoding, easy integration
- **Use case:** Address autocomplete, job location mapping

#### QR Code Generation
**qrcode** + **qr-scanner**
- **Rationale:** Lightweight, reliable QR code generation and scanning
- **Use case:** Worker check-in, job site identification

#### Charts and Visualization
**Recharts**
- **Rationale:** React-native charts library, good TypeScript support, customizable
- **Use case:** Analytics dashboards, time tracking visualizations

#### Notifications
**Sonner** for toast notifications
- **Rationale:** Lightweight, accessible, good UX patterns
- **Use case:** Success/error messages, status updates

### Mobile and Progressive Web App

#### Mobile Strategy
**Responsive Web App** with PWA features
- **Rationale:** Single codebase, faster development, cross-platform compatibility
- **Features:** Offline support, push notifications, app-like experience

#### Mobile-Specific Libraries
**React Signature Canvas** for digital signatures
**Date-fns** for date manipulation and formatting
- **Rationale:** Lightweight alternatives to moment.js, good mobile performance

### Considered Alternatives

#### Alternative Stack 1: MEAN/MERN
- **Pros:** Full JavaScript, flexible NoSQL, large ecosystem
- **Cons:** Need to build auth/real-time/storage, less structured data model
- **Verdict:** Too much custom infrastructure needed

#### Alternative Stack 2: Laravel + Vue.js
- **Pros:** Mature PHP ecosystem, built-in auth, good documentation
- **Cons:** Different languages for frontend/backend, less real-time capabilities
- **Verdict:** Team prefers JavaScript/TypeScript consistency

#### Alternative Stack 3: .NET + React
- **Pros:** Enterprise-ready, excellent tooling, strong typing
- **Cons:** Windows-centric, steeper learning curve, higher infrastructure costs
- **Verdict:** Overengineered for our use case

## Consequences

### Positive
- **Rapid Development:** Integrated stack reduces boilerplate and setup time
- **Type Safety:** End-to-end TypeScript from database to UI
- **Real-time Features:** Built-in real-time capabilities for collaborative features
- **Scalability:** Auto-scaling infrastructure with usage-based pricing
- **Developer Experience:** Excellent tooling and debugging capabilities
- **Mobile Performance:** Optimized for mobile devices with offline capabilities

### Negative
- **Vendor Lock-in:** Heavy dependence on Supabase and Vercel ecosystems
- **Learning Curve:** Team needs to learn Supabase specifics and advanced PostgreSQL
- **Cost Predictability:** Usage-based pricing can scale unexpectedly
- **Limited Customization:** Less control over backend infrastructure

### Neutral
- **Ecosystem Maturity:** Most tools are mature but some (like Supabase) are relatively new
- **Community Support:** Good community support but smaller than traditional stacks

## Implementation

### Action Items
- [x] Set up Next.js 15 project with TypeScript
- [x] Configure Tailwind CSS with shadcn/ui components
- [x] Implement Supabase client and authentication
- [x] Set up React Query for data fetching
- [x] Configure Zustand stores for client state
- [x] Implement React Hook Form with Zod validation
- [x] Set up ESLint and Prettier configuration
- [x] Add Jest testing framework
- [ ] Implement PWA features for mobile
- [ ] Add comprehensive error monitoring
- [ ] Set up performance monitoring

### Migration Considerations
- **Database:** All schema changes must be backward compatible
- **Dependencies:** Regular updates following semantic versioning
- **Breaking Changes:** Create ADR for any major technology changes

## Examples

### Full Stack Feature Implementation
```typescript
// 1. Database Schema (Supabase)
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

// 2. TypeScript Types
interface Job {
  id: string;
  title: string;
  company_id: string;
  created_at: string;
}

// 3. API Route (Next.js)
export async function GET() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json(data);
}

// 4. React Query Hook
function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const response = await fetch('/api/jobs');
      return response.json();
    }
  });
}

// 5. React Component
export function JobsList() {
  const { data: jobs, isLoading } = useJobs();
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="grid gap-4">
      {jobs?.map(job => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
```

## Compliance

### How to follow this decision
- Use approved libraries and versions listed in package.json
- Follow TypeScript strict mode without any overrides
- Implement proper error handling for all external service calls
- Use React Query for all server state management
- Follow component patterns established in the codebase

### How to detect violations
- Package.json audits for unapproved dependencies
- TypeScript compiler errors for type safety
- ESLint rules for code patterns
- Code review checklist for architecture compliance

## References

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [React Query v5 Guide](https://tanstack.com/query/v5)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [React Hook Form Documentation](https://react-hook-form.com/)

---
**Review Date:** 2025-07-01  
**Next Review:** When considering major dependency updates or new technology adoption