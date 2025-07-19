-- Question Reminders Enhancement
-- Adds support for date-based reminders and enhanced question metadata

-- Begin transaction for atomic schema changes
BEGIN;

-- =============================================
-- 1. REMINDERS SYSTEM
-- =============================================

-- Create reminders table for scheduled notifications
CREATE TABLE question_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  question_id UUID NOT NULL REFERENCES stage_questions(id),
  user_response_id UUID NOT NULL REFERENCES user_responses(id),
  reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
  offset_hours INTEGER NOT NULL DEFAULT 24,
  reminder_type VARCHAR(20) DEFAULT 'date_response',
  notification_method VARCHAR(50) DEFAULT 'email',
  notification_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_reminder_type CHECK (reminder_type IN ('date_response', 'task_due', 'stage_timeout')),
  CONSTRAINT valid_notification_method CHECK (notification_method IN ('email', 'sms', 'in_app', 'push')),
  CONSTRAINT unique_reminder UNIQUE (job_id, question_id, user_response_id)
);

-- =============================================
-- 2. ENHANCED STAGE QUESTIONS
-- =============================================

-- Add reminder configuration to stage questions
ALTER TABLE stage_questions 
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS default_reminder_offset_hours INTEGER DEFAULT 24,
ADD COLUMN IF NOT EXISTS reminder_instructions TEXT;

-- =============================================
-- 3. ENHANCED USER RESPONSES
-- =============================================

-- Add reminder metadata to user responses
ALTER TABLE user_responses 
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS reminder_offset_hours INTEGER,
ADD COLUMN IF NOT EXISTS reminder_scheduled_at TIMESTAMP WITH TIME ZONE;

-- =============================================
-- 4. NOTIFICATION QUEUE
-- =============================================

-- Create notification queue for processing reminders
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES question_reminders(id),
  notification_type VARCHAR(50) NOT NULL,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  message_template VARCHAR(100) NOT NULL,
  message_data JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_notification_type CHECK (notification_type IN ('email', 'sms', 'push_notification', 'in_app')),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'))
);

-- =============================================
-- 5. PERFORMANCE INDEXES
-- =============================================

-- Reminders indexes
CREATE INDEX idx_question_reminders_job ON question_reminders(job_id);
CREATE INDEX idx_question_reminders_question ON question_reminders(question_id);
CREATE INDEX idx_question_reminders_date ON question_reminders(reminder_date);
CREATE INDEX idx_question_reminders_unsent ON question_reminders(notification_sent) WHERE NOT notification_sent;

-- Notification queue indexes
CREATE INDEX idx_notification_queue_reminder ON notification_queue(reminder_id);
CREATE INDEX idx_notification_queue_scheduled ON notification_queue(scheduled_for);
CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_pending ON notification_queue(status, scheduled_for) WHERE status = 'pending';

-- =============================================
-- 6. TRIGGER FUNCTIONS
-- =============================================

-- Function to automatically create reminders for date responses
CREATE OR REPLACE FUNCTION create_date_reminder()
RETURNS TRIGGER AS $$
DECLARE
  question_record RECORD;
  reminder_date TIMESTAMP WITH TIME ZONE;
  offset_hours INTEGER;
BEGIN
  -- Only process date type questions
  SELECT sq.response_type, sq.reminder_enabled, sq.default_reminder_offset_hours
  INTO question_record
  FROM stage_questions sq
  WHERE sq.id = NEW.question_id;
  
  -- Check if this is a date response and reminders are enabled
  IF question_record.response_type = 'date' AND 
     (NEW.reminder_enabled OR question_record.reminder_enabled) THEN
    
    -- Parse the date from response_value
    BEGIN
      reminder_date := NEW.response_value::TIMESTAMP WITH TIME ZONE;
      offset_hours := COALESCE(NEW.reminder_offset_hours, question_record.default_reminder_offset_hours, 24);
      
      -- Calculate reminder time
      reminder_date := reminder_date - (offset_hours || ' hours')::INTERVAL;
      
      -- Only create reminder if it's in the future
      IF reminder_date > NOW() THEN
        INSERT INTO question_reminders (
          job_id,
          question_id,
          user_response_id,
          reminder_date,
          offset_hours,
          reminder_type
        ) VALUES (
          NEW.job_id,
          NEW.question_id,
          NEW.id,
          reminder_date,
          offset_hours,
          'date_response'
        );
        
        -- Update user response with reminder info
        UPDATE user_responses 
        SET reminder_scheduled_at = reminder_date
        WHERE id = NEW.id;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the response insert
      RAISE WARNING 'Failed to create reminder for response %: %', NEW.id, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to queue notifications for due reminders
CREATE OR REPLACE FUNCTION queue_due_reminders()
RETURNS INTEGER AS $$
DECLARE
  reminder_record RECORD;
  notification_count INTEGER := 0;
  user_record RECORD;
  job_record RECORD;
  question_record RECORD;
BEGIN
  -- Find reminders that are due and haven't been sent
  FOR reminder_record IN
    SELECT r.*, ur.responded_by
    FROM question_reminders r
    JOIN user_responses ur ON ur.id = r.user_response_id
    WHERE r.reminder_date <= NOW()
    AND NOT r.notification_sent
  LOOP
    -- Get user details
    SELECT u.email, u.phone_number, u.first_name, u.last_name
    INTO user_record
    FROM users u
    WHERE u.id = reminder_record.responded_by;
    
    -- Get job details
    SELECT j.title, j.address
    INTO job_record
    FROM jobs j
    WHERE j.id = reminder_record.job_id;
    
    -- Get question details
    SELECT sq.question_text
    INTO question_record
    FROM stage_questions sq
    WHERE sq.id = reminder_record.question_id;
    
    -- Queue email notification
    IF user_record.email IS NOT NULL THEN
      INSERT INTO notification_queue (
        reminder_id,
        notification_type,
        recipient_email,
        message_template,
        message_data,
        scheduled_for
      ) VALUES (
        reminder_record.id,
        'email',
        user_record.email,
        'date_reminder_email',
        jsonb_build_object(
          'user_name', user_record.first_name || ' ' || user_record.last_name,
          'job_title', job_record.title,
          'job_address', job_record.address,
          'question_text', question_record.question_text,
          'reminder_date', reminder_record.reminder_date
        ),
        NOW()
      );
      
      notification_count := notification_count + 1;
    END IF;
    
    -- Queue SMS notification if phone number available
    IF user_record.phone_number IS NOT NULL THEN
      INSERT INTO notification_queue (
        reminder_id,
        notification_type,
        recipient_phone,
        message_template,
        message_data,
        scheduled_for
      ) VALUES (
        reminder_record.id,
        'sms',
        user_record.phone_number,
        'date_reminder_sms',
        jsonb_build_object(
          'job_title', job_record.title,
          'question_text', question_record.question_text
        ),
        NOW()
      );
      
      notification_count := notification_count + 1;
    END IF;
    
    -- Mark reminder as sent
    UPDATE question_reminders
    SET notification_sent = true, sent_at = NOW()
    WHERE id = reminder_record.id;
  END LOOP;
  
  RETURN notification_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 7. TRIGGERS
-- =============================================

-- Trigger to create reminders when date responses are inserted
CREATE TRIGGER trigger_create_date_reminder
  AFTER INSERT ON user_responses
  FOR EACH ROW
  EXECUTE FUNCTION create_date_reminder();

-- =============================================
-- 8. GRANT PERMISSIONS
-- =============================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON question_reminders TO authenticated;
GRANT SELECT, INSERT, UPDATE ON notification_queue TO authenticated;

-- Grant read-only permissions for system processes
GRANT SELECT ON question_reminders TO anon;
GRANT SELECT ON notification_queue TO anon;

-- =============================================
-- 9. ENABLE ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new tables
ALTER TABLE question_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies
CREATE POLICY "Users can view their reminders" ON question_reminders FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM jobs j
    WHERE j.id = question_reminders.job_id
    AND (
      j.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
    )
  )
);

CREATE POLICY "Users can view their notifications" ON notification_queue FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM question_reminders qr
    JOIN jobs j ON j.id = qr.job_id
    WHERE qr.id = notification_queue.reminder_id
    AND (
      j.company_id = (SELECT company_id FROM users WHERE id = auth.uid())
      OR
      (SELECT role FROM users WHERE id = auth.uid()) = 'site_admin'
    )
  )
);

-- Commit the transaction
COMMIT;

-- =============================================
-- 10. COMMENT DOCUMENTATION
-- =============================================

COMMENT ON TABLE question_reminders IS 'Stores scheduled reminders for date-based question responses';
COMMENT ON TABLE notification_queue IS 'Queue for processing reminder notifications via email/SMS';
COMMENT ON FUNCTION create_date_reminder IS 'Automatically creates reminders when date responses are inserted';
COMMENT ON FUNCTION queue_due_reminders IS 'Queues notifications for reminders that are due';