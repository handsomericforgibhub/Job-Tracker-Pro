# Test Plan: Job Creation Foreign Key Fix

## Issue Fixed
✅ **Issue**: Job creation failing with foreign key violation on `current_stage_id`  
✅ **Cause**: Hardcoded `DEFAULT_STAGE_ID` not existing in `job_stages` table  
✅ **Solution**: Dynamic stage lookup with proper fallback handling

## Changes Made

### 1. Frontend Changes (`src/app/(dashboard)/dashboard/jobs/new/page.tsx`)
- ✅ Added `getInitialStageId()` function for dynamic stage lookup
- ✅ Removed hardcoded `DEFAULT_STAGE_ID` import and usage
- ✅ Added validation to ensure stage exists before job creation
- ✅ Added user-friendly error message when no stages are available

### 2. API Changes (`src/app/api/jobs/route.ts`)
- ✅ Added `current_stage_id` validation before insertion
- ✅ Added auto-assignment of first stage if none provided
- ✅ Enhanced error messages for stage-related issues

### 3. Database Setup (`database-scripts/SETUP-JOB-STAGES-FIX.sql`)
- ✅ Created script to seed job stages if missing
- ✅ Added diagnostics for invalid stage references
- ✅ Provided automated fix suggestions

## Testing Scenarios

### Scenario 1: Normal Job Creation (Happy Path)
**Setup**: Ensure job_stages table has proper stages
**Steps**:
1. Navigate to `/dashboard/jobs/new`
2. Fill in job title: "Test Dynamic Stage Assignment"
3. Complete required fields
4. Submit form

**Expected Results**:
- ✅ Job creates successfully
- ✅ Console shows: "✅ Found initial stage: [Stage Name]"
- ✅ Job is assigned to first stage (sequence_order = 1)
- ✅ No foreign key constraint violations

### Scenario 2: Empty job_stages Table
**Setup**: Clear job_stages table: `DELETE FROM job_stages;`
**Steps**:
1. Try to create a job
2. Check error message

**Expected Results**:
- ❌ Job creation fails gracefully
- ✅ User sees: "Cannot create job: No valid job stages found. Please contact your administrator to set up job stages."
- ✅ No database crash or generic error

### Scenario 3: API Direct Call with Invalid Stage
**Setup**: Direct API call with non-existent stage ID
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "API Test Job",
    "company_id": "[valid-company-id]",
    "current_stage_id": "invalid-stage-id-12345",
    "created_by": "[valid-user-id]"
  }'
```

**Expected Results**:
- ❌ Returns 400 status code
- ✅ Error message: "Invalid stage ID provided. The specified stage does not exist."
- ✅ Details include the invalid stage ID

### Scenario 4: API Auto-Assignment
**Setup**: API call without current_stage_id
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Auto-Stage Assignment Test",
    "company_id": "[valid-company-id]",
    "created_by": "[valid-user-id]"
  }'
```

**Expected Results**:
- ✅ Job created successfully
- ✅ Console shows: "✅ Auto-assigned first stage: [Stage Name]"
- ✅ `current_stage_id` populated with first available stage
- ✅ `stage_entered_at` timestamp added

## Database Setup Commands

### 1. Check Current State
```sql
-- Check if job_stages table has data
SELECT COUNT(*) as stage_count FROM job_stages;

-- Check for invalid job references
SELECT COUNT(*) as invalid_jobs
FROM jobs j
LEFT JOIN job_stages js ON j.current_stage_id = js.id
WHERE j.current_stage_id IS NOT NULL AND js.id IS NULL;
```

### 2. Setup Stages (if needed)
```sql
-- Run the setup script
\i database-scripts/SETUP-JOB-STAGES-FIX.sql
```

### 3. Fix Existing Invalid Jobs
```sql
-- Update jobs with invalid stage references
UPDATE jobs 
SET current_stage_id = (
  SELECT id FROM job_stages 
  ORDER BY sequence_order 
  LIMIT 1
)
WHERE current_stage_id NOT IN (
  SELECT id FROM job_stages
);
```

## Manual Testing Checklist

### Pre-Testing Setup
- [ ] Run `SETUP-JOB-STAGES-FIX.sql` in Supabase
- [ ] Verify job_stages table has 12 stages
- [ ] Confirm user has valid company_id

### Frontend Testing
- [ ] Create job with valid data - should succeed
- [ ] Try creating job when no stages exist - should show friendly error
- [ ] Check browser console for detailed stage information
- [ ] Verify no hardcoded stage IDs in network requests

### API Testing
- [ ] POST with valid data - should auto-assign stage
- [ ] POST with invalid current_stage_id - should return 400
- [ ] POST without current_stage_id - should auto-assign
- [ ] Check API response includes proper error codes

### Database Verification
- [ ] Created jobs have valid current_stage_id
- [ ] current_stage_id references exist in job_stages
- [ ] stage_entered_at timestamp is populated

## Success Criteria

✅ **Fixed**: No more foreign key constraint violations  
✅ **Dynamic**: Stage assignment works from database, not hardcoded values  
✅ **Robust**: Graceful handling when no stages available  
✅ **User-Friendly**: Clear error messages instead of database errors  
✅ **API-Safe**: Server-side validation prevents invalid data  
✅ **Auto-Recovery**: System auto-assigns valid stages when possible  

## Rollback Plan (if needed)

If issues occur, temporarily revert to hardcoded approach:

1. Restore `DEFAULT_STAGE_ID` import in new job page
2. Replace dynamic lookup with hardcoded value
3. Run stage seeding script to ensure hardcoded ID exists
4. Monitor for continued foreign key issues

## Post-Deployment Monitoring

Monitor these metrics after deployment:
- Job creation success rate
- Foreign key constraint violation errors (should be 0)
- Stage assignment distribution (should favor sequence_order = 1)
- User error reports related to job creation