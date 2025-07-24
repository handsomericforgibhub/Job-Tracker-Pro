# ADR-002: Coding Conventions

**Status:** Accepted  
**Date:** 2025-01-24  
**Deciders:** Development Team  
**Technical Story:** Establish consistent code style and patterns

## Context

The job tracker application requires consistent coding standards to ensure:
- Code readability and maintainability across team members
- Reduced cognitive load when switching between files
- Automated enforcement through tooling
- Clear patterns for component composition and data handling
- Type safety throughout the application

The codebase includes TypeScript, React components, API routes, database interactions, and utility functions that all need standardized approaches.

## Decision

We will adopt the following coding conventions and enforce them through ESLint, TypeScript, and code review processes.

### TypeScript Conventions

#### Interface and Type Definitions
```typescript
// Use PascalCase for interfaces and types
interface JobDetails {
  id: string;
  title: string;
  status: JobStatus;
}

// Use descriptive names, avoid abbreviations
type UserRole = 'site_admin' | 'company_admin' | 'foreman' | 'worker';

// Group related types in dedicated files
// src/lib/types.ts - Main application types
// src/lib/types/question-driven.ts - Feature-specific types
```

#### Function and Variable Naming
```typescript
// Use camelCase for functions and variables
const getUserById = async (userId: string): Promise<User | null> => {
  // Implementation
};

// Use descriptive boolean prefixes
const isLoading = true;
const hasPermission = false;
const shouldShowModal = true;

// Use SCREAMING_SNAKE_CASE for constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_PAGINATION_LIMIT = 50;
```

### React Component Conventions

#### Component Structure
```typescript
// 1. Imports (grouped: external, internal, types)
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { JobStatus } from '@/lib/types';

// 2. Interface definition
interface JobCardProps {
  job: Job;
  onStatusChange: (status: JobStatus) => void;
  className?: string;
}

// 3. Component implementation
export function JobCard({ job, onStatusChange, className }: JobCardProps) {
  // 4. Hooks (state, effects, queries)
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { data: assignments } = useQuery({
    queryKey: ['job-assignments', job.id],
    queryFn: () => fetchJobAssignments(job.id)
  });

  // 5. Event handlers
  const handleStatusChange = (newStatus: JobStatus) => {
    onStatusChange(newStatus);
  };

  // 6. Early returns
  if (!job) return null;

  // 7. Render
  return (
    <div className={cn('bg-white rounded-lg shadow', className)}>
      {/* Component JSX */}
    </div>
  );
}
```

#### Component Organization
- **One component per file** with same name as filename
- **Co-locate related components** in feature directories
- **Extract reusable logic** into custom hooks
- **Use composition over inheritance**

### File and Directory Naming

#### Directory Structure
```
src/
├── app/                           # Next.js App Router (kebab-case)
│   ├── (auth)/                   # Route groups in parentheses
│   └── api/                      # API routes
├── components/                    # React components
│   ├── ui/                       # Base UI components (kebab-case files)
│   ├── jobs/                     # Feature components (kebab-case files)
│   └── layout/                   # Layout components
├── lib/                          # Utilities and configurations
│   ├── utils.ts                  # General utilities
│   ├── types.ts                  # Main type definitions
│   └── supabase.ts              # Supabase client
├── hooks/                        # Custom React hooks (camelCase)
└── stores/                       # Zustand stores (kebab-case)
```

#### File Naming Conventions
- **Components:** `kebab-case.tsx` (e.g., `job-status-badge.tsx`)
- **Hooks:** `camelCase.ts` (e.g., `useJobStages.ts`)
- **Utilities:** `kebab-case.ts` (e.g., `date-utils.ts`)
- **Types:** `kebab-case.ts` (e.g., `question-driven.ts`)
- **API Routes:** Follow Next.js conventions with `route.ts`

### API and Database Conventions

#### API Route Structure
```typescript
// app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    
    // Validate input
    if (!params.id) {
      return NextResponse.json(
        { error: 'Job ID is required' }, 
        { status: 400 }
      );
    }

    // Database operation
    const { data, error } = await supabase
      .from('jobs')
      .select('*, foreman:users(full_name)')
      .eq('id', params.id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message }, 
        { status: 400 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

#### Database Query Patterns
```typescript
// Use consistent error handling
const { data, error } = await supabase
  .from('jobs')
  .select('*')
  .eq('company_id', companyId);

if (error) {
  throw new Error(`Failed to fetch jobs: ${error.message}`);
}

// Use descriptive variable names for joins
const { data: jobsWithForemen } = await supabase
  .from('jobs')
  .select(`
    *,
    foreman:users!foreman_id(full_name, email),
    assignments:job_assignments(*)
  `);
```

### CSS and Styling Conventions

#### Tailwind CSS Usage
```typescript
// Use cn() utility for conditional classes
import { cn } from '@/lib/utils';

<div className={cn(
  'base-styles here',
  isActive && 'active-styles',
  className
)} />

// Group related classes logically
<button className={cn(
  // Layout
  'flex items-center gap-2 px-4 py-2',
  // Appearance
  'bg-blue-500 text-white rounded-lg shadow',
  // States
  'hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500',
  // Responsive
  'sm:px-6 md:py-3'
)} />
```

#### Component-Specific Styles
- **Prefer Tailwind utilities** over custom CSS
- **Use CSS modules** only for complex animations or vendor overrides
- **Extract common patterns** into component variants using `class-variance-authority`

### Error Handling Conventions

#### Client-Side Error Handling
```typescript
// Use React Query error boundaries
const { data, error, isLoading } = useQuery({
  queryKey: ['jobs'],
  queryFn: fetchJobs,
  throwOnError: true, // Let error boundary handle it
});

// Handle specific errors locally when needed
if (error instanceof ValidationError) {
  return <ValidationErrorDisplay error={error} />;
}
```

#### Server-Side Error Handling
```typescript
// API routes should return structured errors
return NextResponse.json(
  { 
    error: 'Validation failed',
    details: validationErrors,
    code: 'VALIDATION_ERROR'
  }, 
  { status: 400 }
);
```

### Considered Alternatives

1. **Airbnb JavaScript Style Guide**
   - Pros: Industry standard, comprehensive
   - Cons: Too prescriptive for our use case, conflicts with Next.js patterns

2. **Prettier + ESLint (minimal)**
   - Pros: Simple setup, less configuration
   - Cons: Lacks project-specific patterns, less guidance for team

3. **Chosen: Custom conventions based on Next.js + TypeScript best practices**
   - Pros: Tailored to our stack, enforces good patterns
   - Cons: Requires maintenance, initial setup time

## Consequences

### Positive
- **Consistent Code Style:** Reduced cognitive load when reading code
- **Automated Enforcement:** ESLint catches violations before merge
- **Better Collaboration:** Clear patterns for new team members
- **Type Safety:** Comprehensive TypeScript usage prevents runtime errors
- **Maintainability:** Clear file organization and naming conventions

### Negative
- **Initial Setup Time:** Need to configure ESLint rules and document patterns
- **Learning Curve:** Team needs to learn conventions
- **Potential Rigidity:** May slow down rapid prototyping

### Neutral
- **Code Review Focus:** More time spent on architecture vs. style issues
- **Tool Dependency:** Rely on ESLint and TypeScript for enforcement

## Implementation

### Action Items
- [x] Configure ESLint with Next.js and TypeScript rules
- [x] Set up Prettier for consistent formatting
- [x] Document component patterns in this ADR
- [ ] Create ESLint rules for custom patterns
- [ ] Add pre-commit hooks for style enforcement
- [ ] Create code review checklist

### ESLint Configuration
```javascript
// eslint.config.mjs
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Custom rules for our patterns
      '@typescript-eslint/no-unused-vars': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'prefer-const': 'error',
    }
  }
];
```

## Examples

### Good Examples
```typescript
// ✅ Good: Clear interface, descriptive naming
interface JobStatusBadgeProps {
  status: JobStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function JobStatusBadge({ status, size = 'md', className }: JobStatusBadgeProps) {
  return (
    <Badge 
      variant={getStatusVariant(status)}
      className={cn(sizeClasses[size], className)}
    >
      {status.replace('_', ' ').toUpperCase()}
    </Badge>
  );
}

// ✅ Good: Consistent API pattern
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const { title, description } = await request.json();
  
  const { data, error } = await supabase
    .from('jobs')
    .update({ title, description })
    .eq('id', params.id)
    .select()
    .single();
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  
  return NextResponse.json(data);
}
```

### Bad Examples
```typescript
// ❌ Bad: Vague naming, missing types
function Card(props) {
  return <div className="card">{props.children}</div>;
}

// ❌ Bad: Inconsistent error handling
const data = await supabase.from('jobs').select('*');
// What if there's an error?

// ❌ Bad: Hard-coded strings, no type safety
if (user.role === 'admin') {
  // 'admin' might not match database enum
}
```

## Compliance

### How to follow this decision
- Run `npm run lint` before committing
- Use TypeScript strict mode
- Follow file naming conventions
- Write interfaces for all component props
- Use error boundaries for error handling

### How to detect violations
- ESLint will catch style violations
- TypeScript compiler will catch type errors
- Code review checklist includes style verification
- Pre-commit hooks prevent bad commits

## References

- [Next.js ESLint Configuration](https://nextjs.org/docs/basic-features/eslint)
- [TypeScript Style Guide](https://typescript-eslint.io/rules/)
- [React TypeScript Cheatsheet](https://react-typescript-cheatsheet.netlify.app/)
- [Tailwind CSS Best Practices](https://tailwindcss.com/docs/reusing-styles)

---
**Review Date:** 2025-04-01  
**Next Review:** When major style violations are consistently found in code review