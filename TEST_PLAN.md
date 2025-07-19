# Job Status Update Test Plan

## Current Issues Identified

1. **API Key Error**: "No API key found in request" - Supabase client configuration issue
2. **406 Errors**: company_settings table doesn't exist or has wrong RLS policies
3. **Job Status Update**: Not yet tested with proper authentication

## Test Steps Required

### 1. Login as Site Admin
- Navigate to the application
- Login with site admin credentials
- Verify user role is 'site_admin'

### 2. Navigate to Job Edit Page
- Go to Jobs list
- Select a job (e.g., "Test Job 3")
- Click Edit
- Monitor console for errors

### 3. Test Job Status Update
- Change job status from "planning" to "active"
- Add notes: "Testing status update as site admin"
- Click Update Job
- Monitor console for errors

### 4. Expected Behaviors

#### Success Case:
- No console errors
- Job status updates successfully
- Job status history is logged
- Redirect to job detail page

#### Failure Cases to Check:
- ❌ "Failed to update job: new row violates row-level security policy"
- ❌ "Failed to update job status: Unauthorized" 
- ❌ "No API key found in request"
- ❌ 406 errors from company_settings

## Issues to Fix

### Issue 1: API Key Error
The Supabase client in server-side contexts may not have the API key properly set.

### Issue 2: Missing Tables
The `company_settings` and `platform_settings` tables may not exist in the database.

### Issue 3: RLS Policies
The job_status_history RLS policies may not be properly applied.

## Test Credentials Needed

Please provide:
1. Site admin login credentials
2. Company admin login credentials  
3. Regular user login credentials

## Console Monitoring

Watch for these specific errors:
- Authentication errors (401, 403)
- RLS policy violations (42501)
- Missing table errors (42P01)
- API key errors
- Network errors (406, 500)

## Success Criteria

✅ **Job status update completes without errors**
✅ **Console shows no error messages**
✅ **Job status history is properly logged**
✅ **All user roles can update job status within their permissions**