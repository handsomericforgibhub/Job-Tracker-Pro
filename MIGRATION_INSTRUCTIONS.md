# Database Migration Instructions

## Fix RLS Policy Error

You need to apply the database migration to fix the "Failed to update job: new row violates row-level security policy for table 'job_status_history'" error.

## Option 1: Manual Database Update (Recommended)

1. **Go to your Supabase dashboard**: https://supabase.com/dashboard
2. **Navigate to your project**: iyfrjrudqjftkjvegevi
3. **Go to SQL Editor**
4. **Copy and paste the entire contents** of `database-scripts/20-fix-job-status-history-rls-final.sql`
5. **Click "Run"**

## Option 2: Use API Endpoint

1. **Add your service role key** to `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

2. **Run the API endpoint**:
   ```bash
   curl -X POST http://localhost:3000/api/admin/fix-rls-policies
   ```

## What This Migration Does

1. **Fixes RLS Policies** - Allows system operations (`auth.uid() IS NULL`)
2. **Creates Safe Function** - `update_job_status_safely()` with proper permission checks
3. **Updates Database Triggers** - Handles auth context failures gracefully
4. **Adds Missing Column** - `updated_by` field for audit trail

## After Migration

1. **Test job status changes** in the edit form
2. **Check browser console** for any remaining RLS errors
3. **Verify job status history** is properly logged

## Files Already Updated

- ✅ `src/app/(dashboard)/dashboard/jobs/[id]/edit/page.tsx` - Fixed to use safe API
- ✅ `src/app/api/admin/fix-rls-policies/route.ts` - Updated with comprehensive fixes
- ✅ `database-scripts/20-fix-job-status-history-rls-final.sql` - Database migration ready

The RLS policy error should be completely resolved after running this migration!