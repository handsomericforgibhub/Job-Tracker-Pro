# Testing Automatic Stage Setup

## What was implemented:

1. **Automatic Stage Setup Function** (`src/lib/auto-setup-stages.ts`)
   - Uses service role key to bypass RLS issues
   - Creates all 12 builder preset stages automatically
   - Includes questions and transitions
   - Runs server-side during company creation

2. **API Endpoint** (`src/app/api/companies/[id]/setup-stages/route.ts`)
   - POST endpoint for automatic stage setup
   - Called internally during company registration

3. **Integration with Auth Store** (`src/stores/auth-store.ts`)
   - Added automatic stage setup to both `signUp` and `createProfile` functions
   - Called after company creation but before profile updates
   - Non-blocking (won't fail company creation if stages fail)

4. **UI Updates** (`src/app/(dashboard)/dashboard/admin/system-settings/page.tsx`)
   - Removed "Load Builder Preset" button
   - Added notice that stages are automatically created
   - Removed modal dialog

## How to test:

1. **Register a new company owner account:**
   - Go to `/register`
   - Select "Company Owner" role
   - Enter a company name
   - Complete registration

2. **Check the console logs during registration:**
   - Should see: `🏗️ Setting up default stages for new company...`
   - Should see: `✅ Default stages created: { success: true, stagesCreated: 12, ... }`

3. **After registration, go to System Settings:**
   - Should see stages already populated
   - Should see the notice: "Builder preset stages are automatically created when you register your company"

4. **Check the database:**
   - `job_stages` table should have 12 new stages with your company_id
   - `stage_questions` table should have questions for the stages
   - `stage_transitions` table should have transition rules

## Expected Result:

- No more manual "Load Builder Preset" needed
- No more RLS policy errors during stage creation
- Every new company owner gets stages automatically
- System is more user-friendly and robust

## Fallback:

If automatic setup fails for any reason:
- Company registration still succeeds
- Error is logged but not thrown
- User can still manage stages manually in System Settings