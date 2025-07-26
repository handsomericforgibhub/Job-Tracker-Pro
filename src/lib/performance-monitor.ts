/**
 * Performance Monitoring System
 * 
 * ADR Phase 3: Infrastructure & Optimization
 * This module provides comprehensive performance monitoring, metrics collection,
 * and optimization utilities for the JobTracker application.
 */

import { supabase } from '@/lib/supabase'
import { errorLogger, ErrorCategory, ErrorSeverity } from './error-handler'

// =============================================
// Performance Monitoring Types
// =============================================

export enum MetricType {
  API_RESPONSE_TIME = 'api_response_time',
  DATABASE_QUERY = 'database_query',
  EXTERNAL_API_CALL = 'external_api_call',
  FILE_PROCESSING = 'file_processing',
  REPORT_GENERATION = 'report_generation',
  BACKGROUND_JOB = 'background_job'
}

export interface PerformanceMetric {
  id?: string
  company_id?: string
  metric_type: MetricType
  metric_name: string
  operation_name?: string
  duration_ms: number
  memory_usage_mb?: number
  cpu_usage_percent?: number
  url?: string
  method?: string
  user_id?: string
  request_id?: string
  metadata?: Record<string, any>
  measured_at?: string
}

export interface PerformanceThresholds {
  warning_ms: number
  critical_ms: number
  memory_warning_mb?: number
  memory_critical_mb?: number
}

// =============================================
// Performance Monitor Class
// =============================================

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metricsBuffer: PerformanceMetric[] = []
  private batchSize = 50
  private flushInterval = 10000 // 10 seconds

  // Default performance thresholds
  private static readonly DEFAULT_THRESHOLDS: Record<MetricType, PerformanceThresholds> = {
    [MetricType.API_RESPONSE_TIME]: { warning_ms: 1000, critical_ms: 3000 },
    [MetricType.DATABASE_QUERY]: { warning_ms: 500, critical_ms: 2000 },
    [MetricType.EXTERNAL_API_CALL]: { warning_ms: 2000, critical_ms: 10000 },
    [MetricType.FILE_PROCESSING]: { warning_ms: 5000, critical_ms: 30000 },
    [MetricType.REPORT_GENERATION]: { warning_ms: 10000, critical_ms: 60000 },
    [MetricType.BACKGROUND_JOB]: { warning_ms: 30000, critical_ms: 300000 }
  }

  private constructor() {
    // Start periodic flush (server-side only)
    if (typeof window === 'undefined') {
      setInterval(() => this.flushMetrics(), this.flushInterval)
    }
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  /**
   * Record a performance metric
   */
  public async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      // Add timestamp if not provided
      const enhancedMetric: PerformanceMetric = {
        ...metric,
        measured_at: metric.measured_at || new Date().toISOString(),
        id: crypto.randomUUID()
      }

      // Check thresholds and log warnings/errors
      await this.checkPerformanceThresholds(enhancedMetric)

      // Add to buffer for batch processing
      this.metricsBuffer.push(enhancedMetric)

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[PERF] ${metric.metric_type}:${metric.metric_name} - ${metric.duration_ms}ms`, {
          operation: metric.operation_name,
          url: metric.url,
          metadata: metric.metadata
        })
      }

      // Batch flush when buffer is full
      if (this.metricsBuffer.length >= this.batchSize) {
        await this.flushMetrics()
      }

    } catch (error) {
      // Don't let performance monitoring failures break the application
      console.error('Performance monitoring error:', error)
    }
  }

  /**
   * Check if metric exceeds performance thresholds
   */
  private async checkPerformanceThresholds(metric: PerformanceMetric): Promise<void> {
    const thresholds = PerformanceMonitor.DEFAULT_THRESHOLDS[metric.metric_type]
    
    if (metric.duration_ms >= thresholds.critical_ms) {
      await errorLogger.logError(
        new Error(`Critical performance threshold exceeded: ${metric.metric_name}`),
        {
          category: ErrorCategory.PERFORMANCE,
          severity: ErrorSeverity.CRITICAL,
          metricType: metric.metric_type,
          duration: metric.duration_ms,
          threshold: thresholds.critical_ms,
          operationName: metric.operation_name,
          companyId: metric.company_id,
          userId: metric.user_id
        }
      )
    } else if (metric.duration_ms >= thresholds.warning_ms) {
      await errorLogger.logError(
        new Error(`Performance warning threshold exceeded: ${metric.metric_name}`),
        {
          category: ErrorCategory.PERFORMANCE,
          severity: ErrorSeverity.MEDIUM,
          metricType: metric.metric_type,
          duration: metric.duration_ms,
          threshold: thresholds.warning_ms,
          operationName: metric.operation_name,
          companyId: metric.company_id,
          userId: metric.user_id
        }
      )
    }
  }

  /**
   * Flush buffered metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return

    const metricsToFlush = [...this.metricsBuffer]
    this.metricsBuffer = []

    try {
      const { error } = await supabase
        .from('performance_metrics')
        .insert(metricsToFlush)

      if (error) {
        console.error('Failed to flush performance metrics:', error)
        // Re-add to buffer for retry (but limit size to prevent memory issues)
        if (this.metricsBuffer.length < 1000) {
          this.metricsBuffer.unshift(...metricsToFlush.slice(0, 500))
        }
      }

    } catch (flushError) {
      console.error('Error flushing metrics:', flushError)
    }
  }

  /**
   * Get performance statistics for a company
   */
  public async getPerformanceStats(
    companyId: string,
    metricType?: MetricType,
    hoursBack: number = 24
  ): Promise<{
    avgDuration: number
    maxDuration: number 
    minDuration: number
    sampleCount: number
    slowOperations: Array<{ operation: string; avgDuration: number }>
  }> {
    try {
      let query = supabase
        .from('performance_metrics')
        .select('*')
        .eq('company_id', companyId)
        .gte('measured_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())

      if (metricType) {
        query = query.eq('metric_type', metricType)
      }

      const { data: metrics, error } = await query

      if (error) throw error

      if (!metrics || metrics.length === 0) {
        return {
          avgDuration: 0,
          maxDuration: 0,
          minDuration: 0,
          sampleCount: 0,
          slowOperations: []
        }
      }

      const durations = metrics.map(m => m.duration_ms)
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
      const maxDuration = Math.max(...durations)
      const minDuration = Math.min(...durations)

      // Group by operation and find slow ones
      const operationStats = metrics.reduce((acc, metric) => {
        const op = metric.operation_name || 'unknown'
        if (!acc[op]) {
          acc[op] = { totalDuration: 0, count: 0 }
        }
        acc[op].totalDuration += metric.duration_ms
        acc[op].count += 1
        return acc
      }, {} as Record<string, { totalDuration: number; count: number }>)

      const slowOperations = Object.entries(operationStats)
        .map(([operation, stats]) => ({
          operation,
          avgDuration: stats.totalDuration / stats.count
        }))
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, 10)

      return {
        avgDuration: Math.round(avgDuration * 100) / 100,
        maxDuration,
        minDuration,
        sampleCount: metrics.length,
        slowOperations
      }

    } catch (error) {
      await errorLogger.logError(error as Error, { 
        context: 'get_performance_stats',
        companyId,
        metricType 
      })
      throw error
    }
  }
}

// =============================================
// Performance Monitoring Decorators
// =============================================

/**
 * Decorator to monitor function performance
 */
export function monitored(
  metricType: MetricType,
  metricName: string,
  operationName?: string
) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!

    descriptor.value = async function (...args: T): Promise<R> {
      const monitor = PerformanceMonitor.getInstance()
      const startTime = Date.now()
      const startMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : undefined

      try {
        const result = await method.apply(this, args)
        
        const duration = Date.now() - startTime
        const endMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : undefined
        const memoryUsage = startMemory && endMemory ? (endMemory - startMemory) / 1024 / 1024 : undefined

        await monitor.recordMetric({
          metric_type: metricType,
          metric_name: metricName,
          operation_name: operationName || propertyName,
          duration_ms: duration,
          memory_usage_mb: memoryUsage,
          metadata: {
            success: true,
            methodName: propertyName
          }
        })

        return result

      } catch (error) {
        const duration = Date.now() - startTime

        await monitor.recordMetric({
          metric_type: metricType,
          metric_name: metricName,
          operation_name: operationName || propertyName,
          duration_ms: duration,
          metadata: {
            success: false,
            error: (error as Error).message,
            methodName: propertyName
          }
        })

        throw error
      }
    }

    return descriptor
  }
}

/**
 * Wrapper function to monitor performance of any async function
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  metricType: MetricType,
  metricName: string,
  operationName?: string,
  context?: Record<string, any>
) {
  return async (...args: T): Promise<R> => {
    const monitor = PerformanceMonitor.getInstance()
    const startTime = Date.now()
    const startMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : undefined

    try {
      const result = await fn(...args)
      
      const duration = Date.now() - startTime
      const endMemory = typeof process !== 'undefined' ? process.memoryUsage().heapUsed : undefined
      const memoryUsage = startMemory && endMemory ? (endMemory - startMemory) / 1024 / 1024 : undefined

      await monitor.recordMetric({
        metric_type: metricType,
        metric_name: metricName,
        operation_name: operationName,
        duration_ms: duration,
        memory_usage_mb: memoryUsage,
        ...context,
        metadata: {
          success: true,
          ...context?.metadata
        }
      })

      return result

    } catch (error) {
      const duration = Date.now() - startTime

      await monitor.recordMetric({
        metric_type: metricType,
        metric_name: metricName,
        operation_name: operationName,
        duration_ms: duration,
        ...context,
        metadata: {
          success: false,
          error: (error as Error).message,
          ...context?.metadata
        }
      })

      throw error
    }
  }
}

// =============================================
// Database Query Monitoring
// =============================================

/**
 * Monitor Supabase queries
 */
export function monitoredSupabaseQuery<T>(
  queryBuilder: any,
  operationName: string,
  context?: Record<string, any>
): Promise<T> {
  return withPerformanceMonitoring(
    async () => {
      const { data, error } = await queryBuilder
      if (error) throw error
      return data
    },
    MetricType.DATABASE_QUERY,
    'supabase_query',
    operationName,
    context
  )()
}

/**
 * Monitor external API calls
 */
export function monitoredFetch(
  url: string,
  options?: RequestInit,
  context?: Record<string, any>
): Promise<Response> {
  return withPerformanceMonitoring(
    () => fetch(url, options),
    MetricType.EXTERNAL_API_CALL,
    'fetch_request',
    `${options?.method || 'GET'} ${url}`,
    {
      url,
      method: options?.method || 'GET',
      ...context
    }
  )()
}

// =============================================
// Performance Optimization Utilities
// =============================================

/**
 * Cache with performance monitoring
 */
export class MonitoredCache<T> {
  private cache = new Map<string, { value: T; expires: number }>()
  private monitor = PerformanceMonitor.getInstance()

  constructor(
    private name: string,
    private defaultTtlMs: number = 300000 // 5 minutes
  ) {}

  async get(key: string): Promise<T | null> {
    const startTime = Date.now()
    
    try {
      const cached = this.cache.get(key)
      const hit = cached && cached.expires > Date.now()
      
      await this.monitor.recordMetric({
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: 'cache_access',
        operation_name: `${this.name}_get`,
        duration_ms: Date.now() - startTime,
        metadata: {
          cache_name: this.name,
          cache_hit: !!hit,
          key
        }
      })

      return hit ? cached.value : null
    } catch (error) {
      await this.monitor.recordMetric({
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: 'cache_access',
        operation_name: `${this.name}_get`,
        duration_ms: Date.now() - startTime,
        metadata: {
          cache_name: this.name,
          error: (error as Error).message,
          key
        }
      })
      throw error
    }
  }

  async set(key: string, value: T, ttlMs?: number): Promise<void> {
    const startTime = Date.now()
    
    try {
      const expires = Date.now() + (ttlMs || this.defaultTtlMs)
      this.cache.set(key, { value, expires })
      
      await this.monitor.recordMetric({
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: 'cache_access',
        operation_name: `${this.name}_set`,
        duration_ms: Date.now() - startTime,
        metadata: {
          cache_name: this.name,
          ttl_ms: ttlMs || this.defaultTtlMs,
          key
        }
      })
    } catch (error) {
      await this.monitor.recordMetric({
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: 'cache_access',
        operation_name: `${this.name}_set`,
        duration_ms: Date.now() - startTime,
        metadata: {
          cache_name: this.name,
          error: (error as Error).message,
          key
        }
      })
      throw error
    }
  }

  clear(): void {
    this.cache.clear()
  }

  getStats(): { size: number; hitRate: number } {
    // This would need to be implemented with actual hit/miss tracking
    return { size: this.cache.size, hitRate: 0 }
  }
}

// =============================================
// Singleton Export
// =============================================

export const performanceMonitor = PerformanceMonitor.getInstance()

// =============================================
// Performance Optimization Patterns
// =============================================

/**
 * Debounce function calls to prevent performance issues
 */
export function debounce<T extends any[]>(
  func: (...args: T) => void,
  wait: number
): (...args: T) => void {
  let timeout: NodeJS.Timeout
  
  return (...args: T) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

/**
 * Throttle function calls to limit execution frequency
 */
export function throttle<T extends any[]>(
  func: (...args: T) => void,
  limit: number
): (...args: T) => void {
  let inThrottle: boolean
  
  return (...args: T) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

/**
 * Batch process items to improve performance
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R[]>,
  batchSize: number = 10,
  delayMs: number = 0
): Promise<R[]> {
  const results: R[] = []
  const monitor = PerformanceMonitor.getInstance()
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const startTime = Date.now()
    
    try {
      const batchResults = await processor(batch)
      results.push(...batchResults)
      
      await monitor.recordMetric({
        metric_type: MetricType.BACKGROUND_JOB,
        metric_name: 'batch_process',
        operation_name: 'batch_processing',
        duration_ms: Date.now() - startTime,
        metadata: {
          batch_size: batch.length,
          batch_index: Math.floor(i / batchSize),
          total_batches: Math.ceil(items.length / batchSize)
        }
      })
      
      if (delayMs > 0 && i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
      
    } catch (error) {
      await monitor.recordMetric({
        metric_type: MetricType.BACKGROUND_JOB,
        metric_name: 'batch_process',
        operation_name: 'batch_processing',
        duration_ms: Date.now() - startTime,
        metadata: {
          batch_size: batch.length,
          batch_index: Math.floor(i / batchSize),
          error: (error as Error).message
        }
      })
      throw error
    }
  }
  
  return results
}