-- ================================================
-- JobTracker Pro - Error Logging System
-- ================================================
-- This script creates comprehensive error logging and monitoring
-- tables to support the enhanced error handling system
-- 
-- Order: 04
-- Dependencies: 01-core-database-setup.sql
-- Description: Error logs, performance metrics, monitoring alerts
-- ================================================

-- ================================================
-- 1. ERROR LOGS TABLE (Centralized error tracking)
-- ================================================

CREATE TABLE IF NOT EXISTS error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Error details
  message TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  code TEXT NOT NULL,
  stack_trace TEXT,
  
  -- Context information
  context JSONB DEFAULT '{}',
  url TEXT,
  method TEXT,
  user_agent TEXT,
  ip_address INET,
  request_id TEXT,
  session_id TEXT,
  
  -- Error characteristics
  retryable BOOLEAN DEFAULT FALSE,
  user_friendly_message TEXT,
  
  -- Resolution tracking
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_error_category CHECK (category IN (
    'authentication', 'authorization', 'validation', 'database', 
    'external_api', 'business_logic', 'system', 'performance'
  )),
  CONSTRAINT valid_error_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

-- Error logs indexes
CREATE INDEX IF NOT EXISTS idx_error_logs_company_id ON error_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(category);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON error_logs(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_error_logs_code ON error_logs(code);

-- Enable RLS on error logs (admins and site admins only)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Error logs RLS policy - only admins can view error logs
CREATE POLICY "error_logs_admin_access" ON error_logs
  FOR ALL USING (
    is_site_admin() OR 
    (has_company_access(company_id) AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    ))
  );

-- ================================================
-- 2. PERFORMANCE METRICS TABLE (System monitoring)
-- ================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Metric identification
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  operation_name TEXT,
  
  -- Performance data
  duration_ms INTEGER NOT NULL,
  memory_usage_mb DECIMAL(8,2),
  cpu_usage_percent DECIMAL(5,2),
  
  -- Request context
  url TEXT,
  method TEXT,
  user_id UUID REFERENCES users(id),
  request_id TEXT,
  
  -- Additional metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timing
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_metric_type CHECK (metric_type IN (
    'api_response_time', 'database_query', 'external_api_call', 
    'file_processing', 'report_generation', 'background_job'
  )),
  CONSTRAINT positive_duration CHECK (duration_ms >= 0),
  CONSTRAINT valid_memory_usage CHECK (memory_usage_mb IS NULL OR memory_usage_mb >= 0),
  CONSTRAINT valid_cpu_usage CHECK (cpu_usage_percent IS NULL OR (cpu_usage_percent >= 0 AND cpu_usage_percent <= 100))
);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_company_id ON performance_metrics(company_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_measured_at ON performance_metrics(measured_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_duration ON performance_metrics(duration_ms);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_operation ON performance_metrics(operation_name);

-- Enable RLS on performance metrics
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- Performance metrics RLS policy
CREATE POLICY "performance_metrics_admin_access" ON performance_metrics
  FOR ALL USING (
    is_site_admin() OR 
    (has_company_access(company_id) AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    ))
  );

-- ================================================
-- 3. SYSTEM ALERTS TABLE (Monitoring alerts)
-- ================================================

CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL,
  
  -- Alert rules
  threshold_value DECIMAL(12,4),
  actual_value DECIMAL(12,4),
  threshold_condition TEXT, -- 'greater_than', 'less_than', 'equals', etc.
  
  -- Alert metadata
  source_table TEXT,
  source_record_id UUID,
  context JSONB DEFAULT '{}',
  
  -- Resolution tracking
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES users(id),
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  
  -- Timing
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  CONSTRAINT valid_alert_type CHECK (alert_type IN (
    'error_rate_high', 'performance_degradation', 'database_connection',
    'storage_usage_high', 'failed_jobs_threshold', 'license_expiring',
    'overdue_tasks', 'budget_exceeded', 'custom_rule'
  )),
  CONSTRAINT valid_alert_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_threshold_condition CHECK (threshold_condition IN (
    'greater_than', 'less_than', 'equals', 'not_equals', 'contains', 'not_contains'
  )),
  CONSTRAINT logical_resolution CHECK (
    (resolved = FALSE) OR 
    (resolved = TRUE AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
  )
);

-- System alerts indexes
CREATE INDEX IF NOT EXISTS idx_system_alerts_company_id ON system_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_system_alerts_alert_type ON system_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_triggered_at ON system_alerts(triggered_at);
CREATE INDEX IF NOT EXISTS idx_system_alerts_unresolved ON system_alerts(resolved) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_system_alerts_unacknowledged ON system_alerts(acknowledged) WHERE acknowledged = FALSE;

-- Enable RLS on system alerts
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- System alerts RLS policy
CREATE POLICY "system_alerts_admin_access" ON system_alerts
  FOR ALL USING (
    is_site_admin() OR 
    (has_company_access(company_id) AND EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'admin')
    ))
  );

-- ================================================
-- 4. ERROR ANALYSIS FUNCTIONS
-- ================================================

-- Get error statistics for a company
CREATE OR REPLACE FUNCTION get_error_statistics(
  p_company_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  category TEXT,
  severity TEXT,
  total_count BIGINT,
  resolved_count BIGINT,
  unresolved_count BIGINT,
  average_resolution_time_hours DECIMAL
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    el.category,
    el.severity,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE el.resolved = TRUE) as resolved_count,
    COUNT(*) FILTER (WHERE el.resolved = FALSE) as unresolved_count,
    AVG(EXTRACT(EPOCH FROM (el.resolved_at - el.created_at)) / 3600) 
      FILTER (WHERE el.resolved = TRUE) as average_resolution_time_hours
  FROM error_logs el
  WHERE el.company_id = p_company_id
    AND el.created_at >= p_start_date
    AND el.created_at <= p_end_date
  GROUP BY el.category, el.severity
  ORDER BY total_count DESC;
$$;

-- Get top errors by frequency
CREATE OR REPLACE FUNCTION get_top_errors(
  p_company_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days'
)
RETURNS TABLE (
  code TEXT,
  message TEXT,
  category TEXT,
  severity TEXT,
  count BIGINT,
  latest_occurrence TIMESTAMPTZ,
  resolved_percentage DECIMAL
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    el.code,
    el.message,
    el.category,
    el.severity,
    COUNT(*) as count,
    MAX(el.created_at) as latest_occurrence,
    ROUND(
      (COUNT(*) FILTER (WHERE el.resolved = TRUE)::DECIMAL / COUNT(*)) * 100, 
      2
    ) as resolved_percentage
  FROM error_logs el
  WHERE el.company_id = p_company_id
    AND el.created_at >= p_start_date
  GROUP BY el.code, el.message, el.category, el.severity
  ORDER BY count DESC
  LIMIT p_limit;
$$;

-- Get performance trends
CREATE OR REPLACE FUNCTION get_performance_trends(
  p_company_id UUID,
  p_metric_type TEXT,
  p_operation_name TEXT DEFAULT NULL,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  hour_bucket TIMESTAMPTZ,
  avg_duration_ms DECIMAL,
  max_duration_ms INTEGER,
  min_duration_ms INTEGER,
  sample_count BIGINT
)
LANGUAGE SQL SECURITY DEFINER
AS $$
  SELECT 
    date_trunc('hour', pm.measured_at) as hour_bucket,
    ROUND(AVG(pm.duration_ms), 2) as avg_duration_ms,
    MAX(pm.duration_ms) as max_duration_ms,
    MIN(pm.duration_ms) as min_duration_ms,
    COUNT(*) as sample_count
  FROM performance_metrics pm
  WHERE pm.company_id = p_company_id
    AND pm.metric_type = p_metric_type
    AND (p_operation_name IS NULL OR pm.operation_name = p_operation_name)
    AND pm.measured_at >= NOW() - (p_hours_back || ' hours')::INTERVAL
  GROUP BY date_trunc('hour', pm.measured_at)
  ORDER BY hour_bucket;
$$;

-- ================================================
-- 5. MONITORING ALERT FUNCTIONS
-- ================================================

-- Check and create alerts based on error thresholds
CREATE OR REPLACE FUNCTION check_error_rate_alerts(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  error_count INTEGER;
  alert_threshold INTEGER := 50; -- Errors per hour
  existing_alert_id UUID;
BEGIN
  -- Count errors in the last hour
  SELECT COUNT(*)
  INTO error_count
  FROM error_logs
  WHERE company_id = p_company_id
    AND created_at >= NOW() - INTERVAL '1 hour'
    AND severity IN ('high', 'critical');

  -- Check if threshold exceeded
  IF error_count >= alert_threshold THEN
    -- Check if alert already exists and is unresolved
    SELECT id
    INTO existing_alert_id
    FROM system_alerts
    WHERE company_id = p_company_id
      AND alert_type = 'error_rate_high'
      AND resolved = FALSE
      AND triggered_at >= NOW() - INTERVAL '1 hour';

    -- Create new alert if none exists
    IF existing_alert_id IS NULL THEN
      INSERT INTO system_alerts (
        company_id,
        alert_type,
        title,
        message,
        severity,
        threshold_value,
        actual_value,
        threshold_condition,
        context
      ) VALUES (
        p_company_id,
        'error_rate_high',
        'High Error Rate Detected',
        format('Error rate exceeded threshold: %s errors in the last hour', error_count),
        CASE 
          WHEN error_count >= 100 THEN 'critical'
          WHEN error_count >= 75 THEN 'high'
          ELSE 'medium'
        END,
        alert_threshold,
        error_count,
        'greater_than',
        jsonb_build_object(
          'time_window', '1 hour',
          'error_count', error_count,
          'threshold', alert_threshold
        )
      );

      RETURN 1; -- Alert created
    END IF;
  END IF;

  RETURN 0; -- No alert needed
END;
$$;

-- Check performance degradation alerts
CREATE OR REPLACE FUNCTION check_performance_alerts(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  avg_response_time DECIMAL;
  performance_threshold DECIMAL := 2000; -- 2 seconds
  existing_alert_id UUID;
BEGIN
  -- Calculate average API response time in the last hour
  SELECT AVG(duration_ms)
  INTO avg_response_time
  FROM performance_metrics
  WHERE company_id = p_company_id
    AND metric_type = 'api_response_time'
    AND measured_at >= NOW() - INTERVAL '1 hour';

  -- Check if threshold exceeded
  IF avg_response_time >= performance_threshold THEN
    -- Check if alert already exists and is unresolved
    SELECT id
    INTO existing_alert_id
    FROM system_alerts
    WHERE company_id = p_company_id
      AND alert_type = 'performance_degradation'
      AND resolved = FALSE
      AND triggered_at >= NOW() - INTERVAL '1 hour';

    -- Create new alert if none exists
    IF existing_alert_id IS NULL THEN
      INSERT INTO system_alerts (
        company_id,
        alert_type,
        title,
        message,
        severity,
        threshold_value,
        actual_value,
        threshold_condition,
        context
      ) VALUES (
        p_company_id,
        'performance_degradation',
        'Performance Degradation Detected',
        format('Average API response time: %sms (threshold: %sms)', 
               ROUND(avg_response_time, 0), performance_threshold),
        CASE 
          WHEN avg_response_time >= 5000 THEN 'critical'
          WHEN avg_response_time >= 3000 THEN 'high'
          ELSE 'medium'
        END,
        performance_threshold,
        avg_response_time,
        'greater_than',
        jsonb_build_object(
          'time_window', '1 hour',
          'avg_response_time_ms', avg_response_time,
          'threshold_ms', performance_threshold
        )
      );

      RETURN 1; -- Alert created
    END IF;
  END IF;

  RETURN 0; -- No alert needed
END;
$$;

-- ================================================
-- 6. CLEANUP FUNCTIONS
-- ================================================

-- Clean up old error logs (retain based on severity)
CREATE OR REPLACE FUNCTION cleanup_old_error_logs()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete low severity errors older than 30 days
  DELETE FROM error_logs
  WHERE severity = 'low'
    AND created_at < NOW() - INTERVAL '30 days'
    AND resolved = TRUE;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Delete medium severity errors older than 90 days
  DELETE FROM error_logs
  WHERE severity = 'medium'
    AND created_at < NOW() - INTERVAL '90 days'
    AND resolved = TRUE;

  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

  -- Delete high severity errors older than 1 year
  DELETE FROM error_logs
  WHERE severity = 'high'
    AND created_at < NOW() - INTERVAL '1 year'
    AND resolved = TRUE;

  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

  -- Keep critical errors indefinitely unless explicitly resolved and older than 2 years
  DELETE FROM error_logs
  WHERE severity = 'critical'
    AND created_at < NOW() - INTERVAL '2 years'
    AND resolved = TRUE;

  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Clean up old performance metrics (retain 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_performance_metrics()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  DELETE FROM performance_metrics
  WHERE measured_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN deleted_count;
END;
$$;

-- ================================================
-- SCRIPT COMPLETION
-- ================================================

-- Insert migration record
INSERT INTO schema_migrations (version, applied_at) 
VALUES ('04-error-logging-system', NOW())
ON CONFLICT (version) DO NOTHING;

COMMENT ON TABLE error_logs IS 'Centralized error logging with categorization and resolution tracking';
COMMENT ON TABLE performance_metrics IS 'System performance monitoring and metrics collection';
COMMENT ON TABLE system_alerts IS 'Automated monitoring alerts with acknowledgment workflow';