# Test Plan: Job Creation 409 Conflict Fix

## Testing Scenarios

### 1. Duplicate Title Prevention (Client-Side)
**Test Steps:**
1. Navigate to `/dashboard/jobs/new`
2. Enter job title: "Test Kitchen Renovation"
3. Fill in other required fields
4. Submit the form (first time - should succeed)
5. Navigate back to create another job
6. Enter the same title: "Test Kitchen Renovation"
7. Submit the form (second time)

**Expected Results:**
- Second submission should be prevented with message: "A job with the title 'Test Kitchen Renovation' already exists. Try one of these alternatives:"
- Should display suggestion button with alternative title
- Clicking suggestion should populate the title field with alternative

### 2. API-Level Duplicate Prevention
**Test Steps:**
1. Use API directly or bypass client validation
2. POST to `/api/jobs` with duplicate title
3. Check response

**Expected Results:**
- Should return 409 status code
- Response should include structured error message
- Console should log detailed error information

### 3. Error Message Quality
**Test Steps:**
1. Trigger various error conditions:
   - Duplicate title
   - Invalid company_id
   - Network error
   - Invalid data types

**Expected Results:**
- Each error should have specific, actionable message
- No more empty `{}` error objects
- Console logs should include full error details for debugging

### 4. Error Recovery
**Test Steps:**
1. Trigger duplicate title error
2. Click on suggestion to use alternative title
3. Submit form again

**Expected Results:**
- Error should clear when suggestion is used
- Form should submit successfully with alternative title
- User should be redirected to jobs list

## Manual Testing Commands

### Create Test Job via API:
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "title": "Test Kitchen Renovation",
    "company_id": "[company-uuid]",
    "created_by": "[user-uuid]",
    "status": "planning"
  }'
```

### Create Duplicate Job:
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "title": "Test Kitchen Renovation",
    "company_id": "[same-company-uuid]",
    "created_by": "[user-uuid]",
    "status": "planning"
  }'
```

**Expected Response:**
```json
{
  "error": "A job with the title \"Test Kitchen Renovation\" already exists in your company",
  "code": "23505",
  "details": "Duplicate job title within company"
}
```

## Browser Console Testing

### Check Error Logging:
1. Open browser dev tools console
2. Try to create duplicate job
3. Look for detailed error logs:
   - Should see full error object (not `{}`)
   - Should include error codes and details
   - Should show user-friendly messages

### Verify Suggestions:
1. Monitor network tab during duplicate creation
2. Check if title uniqueness check fires
3. Verify suggestion generation logic

## Success Criteria

✅ **Fixed**: No more empty `{}` error messages  
✅ **Enhanced**: Detailed error logging for debugging  
✅ **Improved**: User-friendly error messages  
✅ **Added**: Pre-submission duplicate checking  
✅ **Implemented**: Error recovery with title suggestions  
✅ **Created**: API-level validation and error handling  

## Cleanup After Testing

Remember to delete test jobs created during testing:
```sql
DELETE FROM jobs WHERE title LIKE 'Test Kitchen Renovation%';
```