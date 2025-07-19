# Apply Worker Applications & Assignment Sharing Schema

To enable the new worker onboarding and assignment sharing features, you need to apply the database migration script.

## Quick Setup Instructions

1. **Access your Supabase dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Run the migration script**
   - **Option A (Recommended):** Copy the contents of `database-scripts/12-worker-applications-schema-simple.sql`
   - **Option B:** Copy the contents of `database-scripts/12-worker-applications-schema.sql` 
   - Paste it into the SQL Editor
   - Click "Run" to execute the script
   
   > **Note:** If you get a syntax error with "IF NOT EXISTS", use the `-simple.sql` version which is more compatible.

3. **Verify the setup**
   - The script will create:
     - `worker_applications` table for public applications
     - Assignment sharing columns in `job_assignments` table
     - `assignment_access_logs` table for security
     - Storage bucket for application documents
     - Triggers for automatic token generation

## Alternative: Manual Table Creation

If you prefer to create just the basic table structure first, you can run this minimal SQL:

```sql
-- Basic worker applications table
CREATE TABLE IF NOT EXISTS worker_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    work_experience TEXT,
    years_experience INTEGER,
    desired_hourly_rate NUMERIC(10,2),
    skills TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add sharing columns to job_assignments (if they don't exist)
ALTER TABLE job_assignments 
ADD COLUMN IF NOT EXISTS share_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMP WITH TIME ZONE;
```

## Features Enabled After Schema Application

### Worker Onboarding
- Public application form at `/apply/worker`
- Owner approval dashboard at `/dashboard/applications`
- Automatic worker account creation on approval

### Assignment Sharing
- Share job assignments with workers via secure links
- Public assignment viewing at `/share/assignment/[token]`
- Mobile-optimized interface with GPS directions

## Testing the Setup

1. **Test Applications**
   - Visit `/dashboard/applications` (should load without errors)
   - Applications list will be empty initially (this is normal)

2. **Test Public Application Form**
   - Visit `/apply/worker` 
   - Fill out and submit a test application
   - Check the applications dashboard to see it appear

3. **Test Assignment Sharing** (after schema is applied)
   - Go to job assignments in the dashboard
   - Look for share toggle functionality
   - Generate share links for workers

## Troubleshooting

If you see "Failed to fetch applications" error:
- ✅ The database schema hasn't been applied yet
- ✅ Run the migration script from step 2 above
- ✅ Refresh the applications page

If you see "Worker applications table not found":
- ✅ This confirms the table needs to be created
- ✅ Follow the setup instructions above