# User Interface & Component Flows – Job-Ops Platform (MVP)

This document outlines the primary user flows and embedded component-level prompts for building the UI layer of the Job-Ops platform. All flows are mobile-first and optimized for on-site usability.

---

## 1. Worker Journey

### Flow: Daily Work Routine

1. **Login**
2. Land on **My Tasks**
3. Select an assigned task → open *Task Detail*
4. Tap **Check In**
   - QR scanner opens
   - Once QR is scanned:
     - Request GPS permissions
     - If within allowed radius → check-in success
     - If outside radius → show fallback path for manual upload

5. Task in progress...
6. Tap **Complete Task**
   - Photo uploader appears (enforce required photo count if set)
   - Optional: Add incident notes or job comments
   - Confirm → status updated to `complete`

```component
name: CheckInScreen
props: { token: string }
description: |
  1. Resolve token to task_assignment_id.
  2. Request geolocation; validate within allowed radius.
  3. If valid, POST /tasks/{task_id}/check-in.
  4. If outside radius, offer fallback with manual photo + note.
```

---

## 2. Foreman Flows

### 2.1 Project Setup Wizard

1. Choose/Create Project
2. Enter site address (Geoapify validate)
3. Choose stage template (or create new)
4. Colour select per stage (optional custom hex or pick from preset)
5. Assign Foreman and Workers
6. Save → land on *Project Dashboard*

```component
name: ProjectStageEditor
props: { templateId: string }
description: |
  Load existing template or create new.
  Let user define stage name, colour, sequence.
  Support save-as-template for reuse.
```

---

### 2.2 Calendar Event Creation

1. Navigate to *Project Dashboard → Calendar Tab*
2. Tap “Add Event”
3. Choose:
   - Category (Delivery, Concrete Pour, Subcontractor, Inspection, Milestone, Weather Hold)
   - Start / End Time (30-min blocks)
   - Optional: Toggle `Weather-sensitive`
   - Optional: Toggle `Client Meeting`

4. Save → Event shown on timeline

---

### 2.3 Client Meeting SMS Reminder Flow

Triggered: 24 hours before a `calendar_event` or `project_stage` where `requires_client_meeting = true`.

1. Push notification arrives  
   > “Client meeting for *Granny Flat Job* tomorrow at 10:00am. Send SMS reminder?”

2. Modal Preview opens:
   - Pre-filled message:  
     “Hi John, just a reminder we’re scheduled to meet tomorrow (Thu) at 10am on-site for the Granny Flat job. Let me know if anything changes. – Mike”

3. Buttons: **Send SMS** | **Skip**

4. **Send SMS** → open device SMS app:
   - Uses `sms:` deep-link with number + encoded message body.
   - Foreman can edit before sending.

```component
name: ClientMeetingReminderModal
props: { eventId: string }
description: |
  Loads client's phone & default or custom SMS template.
  Shows preview and launches SMS composer via deep-link:
  sms:+61400123456?body=urlEncodedText
```

---

## 3. Owner Flows

### 3.1 Subscription & Billing

1. Navigate to **Company Settings → Subscription**
2. View:
   - Current Plan
   - Billing Rank (e.g. #8 → 90% discount for life)
   - Discount tier notice
3. Option to upgrade / downgrade
4. Enter payment method (PayPal or Direct Debit BECS)
5. Save → PDF tax invoice generated and emailed

```component
name: BillingRankBadge
props: { rank: number }
description: |
  Display rank with tier label and discount info.
  Example: "#8 of first 10 → 90% off for life"
```

---

### 3.2 Company-wide Dashboard

1. Shows Gantt chart of all active projects
   - Horizontal bars per project
   - Colour-coded stages with labels
2. Filter: status, Foreman, due this week
3. Export to PDF (landscape format)

```task
title: ExportCompanyGanttToPDF
description: >
  Render company-wide Gantt view into A4 landscape.
  Embed logo from company profile; include legend.
```

---

## 4. Admin Console

### 4.1 Task Reassignment (Bulk)

1. Admin selects a departing Worker
2. See all active tasks assigned to that user
3. Multi-select → choose replacement Worker → confirm

```task
title: BulkReassignTasks
description: >
  UPDATE task_assignments SET worker_id = :new_worker
  WHERE worker_id = :old_worker AND status != 'complete';
```

---

### 4.2 Manual License Approval

1. Admin opens **Pending Workers**
2. Review uploaded licence + expiry + metadata
3. Approve or Reject
4. Approval triggers onboarding flow

---

## 5. Scheduled Jobs (Platform-Cron)

| Job Name                      | Frequency     | Purpose                                                                 |
|------------------------------|---------------|-------------------------------------------------------------------------|
| `ScheduleClientMeetingReminder` | Hourly      | Find upcoming `requires_client_meeting = true` items → notify Foreman |
| `WeatherAlertScheduler`         | 2× per day   | Pull forecast from Open-Meteo; flag rain > 30% on tasks/events         |
| `LicenseExpiryNotifier`         | Daily        | Remind Workers + Owners about upcoming licence expiry                  |
| `AutoEscalateMissedCheckin`     | Every 15 min | Escalate missing check-ins after 30 min to Foreman, then to Owner      |

```task
title: ScheduleClientMeetingReminder
description: >
  SELECT calendar_events and project_stages
  WHERE requires_client_meeting = true
    AND scheduled_start BETWEEN now()+24h AND now()+25h
  → Create notification row for each assigned foreman
```

---

## 6. Design System Notes

- Colours: All user-selectable stage colours must pass WCAG AA contrast (recommended use: HSL ranges with dark text).
- Icons: QR code, photo upload, GPS pin, calendar, weather alert
- Typography: Extra large task titles for mobile in direct sunlight
- Language: Supports English, Traditional Chinese, Simplified Chinese

---

## 7. Mobile-First Constraints

- Offline caching (future): Task data + photo capture → queued for sync
- Progressive enhancement: Fallback to web if SMS deep-link fails
- Minimum OS:
  - iOS 15+
  - Android 10 (API 29)+