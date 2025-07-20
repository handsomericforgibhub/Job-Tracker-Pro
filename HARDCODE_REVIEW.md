# Hardcode Review & Refactoring Plan

**Generated:** 2025-07-19  
**Status:** In Progress  
**Priority:** High - Code maintainability and consistency

## 📋 Instructions for Implementation
**Process:** Work through categories sequentially starting with Category 1. After completing each category:
1. Report any SQL code that needs to be run and where to test on the platform
2. Mention the next category before asking for permission to proceed
3. Update this document to mark completed items

## 🎯 Overview

This document catalogs all hardcoded values found across the codebase that should be centralized for better maintainability, consistency, and configuration management.

---

## 📋 Findings by Category

### 🏗️ **Category 1: Job Stage Names & Definitions**
**Impact:** High - Business logic spread across multiple files  
**Files Affected:** 47+ files

#### **Stage Names (Hardcoded across codebase):**
```typescript
// Found in multiple files:
"1/12 Lead Qualification"
"2/12 Initial Client Meeting" 
"3/12 Site Assessment & Quote"
"4/12 Quote Submission"
"5/12 Client Decision"
"6/12 Contract & Deposit"
"7/12 Material Ordering"
"8/12 Material Delivery"
"9/12 Construction Start"
"10/12 Quality & Inspections"
"11/12 Client Walkthrough"
"12/12 Handover & Close"
```

#### **Hardcoded Stage IDs:**
```typescript
// Primary example - used 20+ times:
'550e8400-e29b-41d4-a716-446655440001' // Lead Qualification
'550e8400-e29b-41d4-a716-446655440002' // Initial Client Meeting
// ... and 10 more stage UUIDs
```

#### **Files Requiring Updates:**
- `src/app/(dashboard)/dashboard/admin/system-settings/page.tsx:218-541` (Builder Preset Data)
- `src/app/(dashboard)/dashboard/jobs/new/page.tsx:91` (Default stage assignment)
- `src/app/(dashboard)/dashboard/jobs/[id]/edit/page.tsx:757,916-917` (Stage references)
- `src/app/api/admin/load-stages/route.ts` (Complete stage definitions)
- `src/app/api/admin/load-stages-simple/route.ts`
- `database-scripts/31-seed-initial-stages-data.sql` (Seed data)
- `database-scripts/33-migrate-existing-jobs-to-question-driven.sql` (Migration scripts)
- `scripts/load-stages.js` (Load scripts)
- Multiple other API endpoints and components

---

### 🎨 **Category 2: Color Codes & Visual Styling**
**Impact:** Medium - UI consistency and theming  
**Files Affected:** 15+ files

#### **Stage Colors (50+ instances):**
```typescript
// Stage colors in system-settings/page.tsx:
"#EF4444" // Red - Lead Qualification
"#F97316" // Orange - Initial Client Meeting  
"#EAB308" // Yellow - Site Assessment
"#84CC16" // Lime - Quote Submission
"#22C55E" // Green - Client Decision
"#06B6D4" // Cyan - Contract & Deposit
"#3B82F6" // Blue - Material Ordering
"#6366F1" // Indigo - Material Delivery
"#8B5CF6" // Purple - Construction Start
"#EC4899" // Pink - Quality & Inspections
"#F59E0B" // Amber - Client Walkthrough
"#10B981" // Emerald - Handover & Close
```

#### **Chart/Analytics Colors:**
```typescript
// In analytics/page.tsx:
"#8884d8" // Primary chart color
"#82ca9d" // Secondary chart color  
"#ffc658" // Tertiary chart color
```

#### **System Colors (Database scripts):**
```typescript
// Priority colors:
"#6B7280" // Low priority
"#F59E0B" // Medium priority
"#EF4444" // High priority
"#DC2626" // Urgent priority

// Status colors:
"#6B7280" // To Do
"#3B82F6" // In Progress
"#10B981" // Completed
"#EF4444" // Blocked
```

#### **Files Requiring Updates:**
- `src/app/(dashboard)/dashboard/admin/system-settings/page.tsx:220-541,1744`
- `src/app/(dashboard)/dashboard/analytics/page.tsx:413,445,467,554-556,705-706,728`
- `database-scripts/14-admin-configuration-schema.sql:292-361`
- `database-scripts/16-complete-site-admin-setup.sql:635-671`
- `database-scripts/17-project-hierarchy-schema.sql:319-358`

---

### ⚙️ **Category 3: Status & Type Mappings**
**Impact:** High - Business logic and data validation  
**Files Affected:** 10+ files

#### **Job Status Values:**
```typescript
// Found in lib/types.ts and multiple components:
'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled'

// Task status values:  
'pending' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled'
```

#### **Stage Types:**
```typescript
// In stage definitions:
'standard' | 'milestone'

// Maps to status:
'planning' | 'active' | 'completed'
```

#### **Files Requiring Updates:**
- `src/lib/types.ts:52,132,231,273` (Type definitions)
- `src/hooks/useJobStages.ts:107-195` (Status configurations)
- Multiple API validation points
- Database schema definitions

---

### 📝 **Category 4: Question Response Types**
**Impact:** Medium - Form validation and UI components  
**Files Affected:** 8+ files

#### **Response Type Values:**
```typescript
// Found across question-driven components:
'yes_no' | 'text' | 'number' | 'date' | 'file_upload' | 'multiple_choice'
```

#### **Response Type Configurations:**
```typescript
// In system-settings/page.tsx:183-188:
{ value: 'yes_no', label: 'Yes/No', icon: ToggleLeft },
{ value: 'text', label: 'Text Input', icon: Type },
{ value: 'number', label: 'Number', icon: Hash },
{ value: 'date', label: 'Date', icon: Calendar },
{ value: 'multiple_choice', label: 'Multiple Choice', icon: Target },
{ value: 'file_upload', label: 'File Upload', icon: Upload }
```

#### **Files Requiring Updates:**
- `src/lib/types/question-driven.ts:50-55` (Type definitions)
- `src/app/(dashboard)/dashboard/admin/system-settings/page.tsx:183-188,690,724,985-989,1287,1355-1382,2290-2415`
- `src/components/question-driven/MobileQuestionInterface.tsx:149-372`
- `src/app/api/jobs/[id]/stage-response/route.ts:234-259` (Validation)
- `src/app/api/admin/stages/questions/route.ts:72` (API processing)
- `src/app/api/admin/load-stages/route.ts:163-297` (Seed data)

---

### 🌐 **Category 5: External URLs & Endpoints**
**Impact:** Low-Medium - Environment configuration  
**Files Affected:** 5+ files

#### **Hardcoded URLs:**
```typescript
// Supabase fallbacks:
'https://demo.supabase.co' // in lib/supabase.ts:3,14

// External APIs:
'https://api.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}'
'https://storage.example.com/uploads/${file.name}'
'https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}'

// Documentation/Help links:
'https://supabase.com'
'https://github.com/supabase/supabase'
```

#### **Files Requiring Updates:**
- `src/lib/supabase.ts:3,7,14`
- `src/app/demo/page.tsx:90,109,120`
- `src/components/question-driven/FileUploadHandler.tsx:138`
- `src/app/qr-checkin/[jobId]/page.tsx:121`
- `src/app/share/assignment/[token]/page.tsx:136`

---

### 🔧 **Category 6: Configuration Values & Timeouts**
**Impact:** Low - Performance and UX tuning  
**Files Affected:** 3+ files

#### **Timeout Values:**
```typescript
// In various components:
3000 // ms - QR checkin timeout
120000 // ms - Default API timeout (from previous work)
600000 // ms - Max API timeout (from previous work)
```

#### **Default Values:**
```typescript
// Pagination and limits:
1000 // Record limit in deletion APIs
500  // Batch size for bulk operations  
100  // Batch size in audit log cleanup
```

---

## 🛠️ Proposed Refactoring Plan

### **Phase 1: Create Central Configuration Files**

#### **1. `src/config/stages.ts`**
```typescript
export const STAGE_DEFINITIONS = {
  LEAD_QUALIFICATION: {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: '1/12 Lead Qualification',
    description: 'Initial assessment of lead viability and requirements',
    color: '#EF4444',
    sequence_order: 1,
    // ... complete stage config
  },
  // ... all 12 stages
}

export const DEFAULT_STAGE_ID = STAGE_DEFINITIONS.LEAD_QUALIFICATION.id;
```

#### **2. `src/config/constants.ts`**
```typescript
export const JOB_STATUSES = {
  PLANNING: 'planning',
  ACTIVE: 'active', 
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const RESPONSE_TYPES = {
  YES_NO: 'yes_no',
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  FILE_UPLOAD: 'file_upload',
  MULTIPLE_CHOICE: 'multiple_choice'
} as const;

export const TIMEOUTS = {
  QR_CHECKIN: 3000,
  API_DEFAULT: 120000,
  API_MAX: 600000
} as const;
```

#### **3. `src/config/colors.ts`**
```typescript
export const THEME_COLORS = {
  // Stage colors
  STAGES: {
    LEAD_QUALIFICATION: '#EF4444',
    INITIAL_CLIENT_MEETING: '#F97316',
    // ... all stage colors
  },
  
  // System colors
  PRIORITY: {
    LOW: '#6B7280',
    MEDIUM: '#F59E0B', 
    HIGH: '#EF4444',
    URGENT: '#DC2626'
  },
  
  // Chart colors
  CHARTS: {
    PRIMARY: '#8884d8',
    SECONDARY: '#82ca9d',
    TERTIARY: '#ffc658'
  }
};
```

#### **4. `src/config/endpoints.ts`**
```typescript
export const EXTERNAL_URLS = {
  SUPABASE_FALLBACK: 'https://demo.supabase.co',
  OPENSTREETMAP_API: 'https://api.openstreetmap.org',
  GOOGLE_MAPS_DIRECTIONS: 'https://www.google.com/maps/dir/',
  STORAGE_EXAMPLE: 'https://storage.example.com'
};
```

### **Phase 2: Update Type Definitions**
- Convert string literals to enums using config constants
- Update all type definitions to reference central config

### **Phase 3: Systematic File Updates**
- Replace hardcoded values with config references
- Update imports across all affected files
- Ensure backwards compatibility during transition

### **Phase 4: Validation & Testing**
- Verify all hardcoded values are replaced
- Test stage creation, job flows, and admin functions
- Confirm no regressions in functionality

---

## 📊 Implementation Priority

### **🔥 High Priority (Business Critical)**
1. **Stage Definitions** - 47 files affected, core business logic
2. **Status Mappings** - Critical for job workflow and validation  
3. **Response Types** - Essential for question-driven system

### **🟡 Medium Priority (UI/UX)**
4. **Color Codes** - UI consistency and theming
5. **Question Configurations** - Form behavior and validation

### **🟢 Low Priority (Infrastructure)**
6. **External URLs** - Environment-specific configuration
7. **Timeout Values** - Performance tuning

---

## ✅ Tracking Progress

### **Completed:**
- [x] Comprehensive codebase audit
- [x] Categorized all hardcoded values
- [x] Identified affected files and line numbers
- [x] Created refactoring plan
- [x] **CATEGORY 1 COMPLETE**: Job Stage Names & Definitions
  - [x] Created `/src/config/stages.ts` with actual database UUIDs
  - [x] Updated API routes to use central configuration
  - [x] Updated job creation/editing pages
  - [x] Updated system-settings page
  - [x] Synchronized TypeScript config with existing database
- [x] **CATEGORY 2 COMPLETE**: Color Codes & Visual Styling
  - [x] Created `/src/config/colors.ts` with centralized color configuration
  - [x] Updated system-settings page to use central color config
  - [x] Updated analytics page to use central color config  
  - [x] Created database script `update-stage-colors-centralized.sql`
  - [x] Added helper functions for color retrieval (getStageColor, getStatusColor, getPriorityColor)
- [x] **CATEGORY 3 COMPLETE**: Status & Type Mappings
  - [x] Created `/src/config/constants.ts` with centralized constants
  - [x] Updated `/src/lib/types.ts` to use central type definitions
  - [x] Updated `/src/lib/types/question-driven.ts` with central types
  - [x] Updated `/src/hooks/useJobStages.ts` status configurations
  - [x] Updated API validation in task management endpoints
  - [x] Added comprehensive validation helpers and status transition logic
- [x] **CATEGORY 4 COMPLETE**: Question Response Types
  - [x] Extended `/src/config/constants.ts` with response type configuration
  - [x] Updated system-settings page response type configurations
  - [x] Updated MobileQuestionInterface component to use central constants
  - [x] Updated API validation in stage-response and questions routes
  - [x] Created `/scripts/constants.js` for Node.js scripts
  - [x] Updated `/scripts/load-stages.js` with central response types
  - [x] Added RESPONSE_TYPE_CONFIG array for UI components with icons
- [x] **CATEGORY 5 COMPLETE**: External URLs & Endpoints
  - [x] Created `/src/config/endpoints.ts` with centralized endpoint configuration
  - [x] Updated Supabase configuration with fallback URLs and environment helpers
  - [x] Updated OpenStreetMap API calls in time-clock, QR checkin, and document upload
  - [x] Updated Google Maps directions API in share assignment page
  - [x] Updated demo page documentation links to use central config
  - [x] Updated file upload handler with central storage configuration
  - [x] Added URL validation helpers and environment-specific functions

### **Next Steps:**
- [x] **CATEGORY 6 COMPLETE**: Configuration Values & Timeouts (3+ files)
  - [x] Created `/src/config/timeouts.ts` with centralized timeout and limit configuration
  - [x] Updated QR checkin timeout from hardcoded 3000ms to central config
  - [x] Updated geolocation timeouts (10000ms timeout, 300000ms max age) to use central config
  - [x] Updated UI feedback timeouts (copy success 2000ms, notifications 5000ms) to central config
  - [x] Updated file size limits across components (documents 50MB, photos 20MB, licenses 5MB)
  - [x] Updated pagination limits across API routes (default 50, large 100)
  - [x] Updated upload progress interval (200ms) and other UI timing values
  - [x] Updated QR code sizes (default 256px, export 512px) and Gantt chart height (600px max)
  - [x] Updated signature pen width limits (min 1px, max 3px) and autocomplete limits (5 results)
  - [x] Added helper functions and comprehensive type exports for configuration access
- [ ] Final validation and testing

---

## 🚨 Risk Assessment

### **Risks:**
- **Breaking Changes:** Extensive refactoring across 50+ files
- **Database Dependencies:** Some hardcoded UUIDs are in database seed scripts
- **API Compatibility:** Changes could affect API contracts

### **Mitigation:**
- **Phased Approach:** Implement in stages with testing between phases
- **Backwards Compatibility:** Keep old constants available during transition
- **Comprehensive Testing:** Test all affected workflows after each phase
- **Database Migration:** Update seed scripts and migration files carefully

---

*This document will be updated as refactoring progresses. Each completed item will be marked with ✅ and dated.*