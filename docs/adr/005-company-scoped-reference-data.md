ADR-005: Company-Scoped Reference Data & System Settings
Status: Proposed
Date: [Today’s date]
Deciders: Development Team
Technical Story: Enable per-company customization of workflow stages, status colors, and other reference data

Context
The job tracking platform serves multiple independent companies (tenants), each with potentially unique workflow requirements, terminology, and branding. Key aspects such as job stage names, workflow sequences, status colours (e.g. for Gantt charts), and other business rules must be customizable at the company level.

Current Situation:

System-wide constants and reference data (e.g., stage names, colour codes) may be hard-coded or globally defined.

This limits flexibility, increases code complexity, and fails to support true SaaS multi-tenancy.

Forces at play:

Each company expects to manage its own workflow, status naming, and appearance.

The system must enforce data isolation, minimize hardcoding, and maximize configurability.

Constraints:

Must not expose one company’s settings to another.

Configuration changes should be manageable through the admin UI, not just via code or database migrations.

Decision
We will implement a company-scoped reference data system for all configurable business logic and appearance settings.

All settings and reference data that may differ by company (stage names, workflow steps, status/Gantt colours, etc.) will be stored in dedicated database tables with a company_id foreign key.

The application must always read these values at runtime, filtered by the active user’s company_id.

System logic and UI will never use hard-coded values for these configurable items.

Company administrators will be provided with an admin UI to manage their own configuration data.

Considered Alternatives
Hard-coded or global constants

Pros: Fast to implement, simple code.

Cons: Not tenant-aware, poor flexibility, requires code changes for each company.

Company-level configuration tables (Chosen)

Pros: Enables true multi-tenancy, allows per-company customization, scalable as platform grows.

Cons: Adds some data model complexity, requires robust admin UI.

External configuration microservice

Pros: Central API for configuration, future scalability.

Cons: Overkill for current needs, increased operational complexity.

Consequences
Positive
True multi-tenancy: Each company can tailor stages, colours, and business logic.

No hardcoding: Reduces risk of logic errors and code bloat.

Admin empowerment: Company admins control their workflow/settings.

Auditability: All changes are stored in the database, improving compliance.

Negative
More tables: Slight increase in database and code complexity.

Migration required: Legacy hard-coded values must be refactored.

Neutral
Performance: Slightly more database queries, but easily indexed and cached.

Implementation
Action Items
 Design and implement configuration tables (e.g. company_stages, company_colors, etc.).

 Migrate existing constants to company-scoped tables.

 Update all queries and UI components to fetch configuration per company.

 Build/extend admin UI for company-level configuration.

 Document the process for adding new configurable items.

Timeline
Phase 1: Table design, data model update, basic admin UI — [Date]

Phase 2: Migration of existing logic, QA, and roll-out — [Date]

Examples

CREATE TABLE company_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  order_num INT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Application query
SELECT * FROM company_stages WHERE company_id = :currentCompanyId ORDER BY order_num;

// React component fetches stages by company
const { data: stages } = useQuery({
  queryKey: ['company-stages', companyId],
  queryFn: () => fetchCompanyStages(companyId)
});
Compliance
How to follow this decision
All reference data for business logic/appearance must be defined in company-scoped tables.

No hard-coded or global constants for tenant-specific settings.

All admin UI and business logic must filter/reference the active company.

How to detect violations
Code review checklist: flag hard-coded stages, colours, etc.

Automated linter or test: scan for magic strings/constants in codebase.

Periodic audits of configuration management.

References
Multi-Tenant SaaS Reference Data Patterns

Supabase Row Level Security

[Your other ADRs]

Review Date: [Next review date]
Next Review: [Set recurring review]