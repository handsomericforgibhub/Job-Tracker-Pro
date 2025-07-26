/**
 * Comprehensive Error Handling and Logging System
 * 
 * ADR Phase 3: Infrastructure & Optimization
 * This module provides centralized error handling, logging, and monitoring
 * for the multi-tenant JobTracker application.
 */

import { supabase } from '@/lib/supabase'
import { NextRequest } from 'next/server'

// =============================================
// Error Types and Interfaces
// =============================================

export enum ErrorCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization', 
  VALIDATION = 'validation',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  PERFORMANCE = 'performance'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  userId?: string
  companyId?: string
  requestId?: string
  userAgent?: string
  ipAddress?: string
  url?: string
  method?: string
  timestamp?: string
  sessionId?: string
  additionalData?: Record<string, any>
}

export interface ApplicationError {
  id: string
  message: string
  category: ErrorCategory
  severity: ErrorSeverity
  code: string
  context: ErrorContext
  stack?: string
  cause?: Error
  retryable: boolean
  userFriendlyMessage: string
}

export interface ErrorLogEntry {
  id: string
  error: ApplicationError
  resolved: boolean
  resolvedAt?: string
  resolvedBy?: string
  resolution?: string
  created_at: string
}

// =============================================
// Custom Error Classes
// =============================================

export class JobTrackerError extends Error {
  public readonly id: string
  public readonly category: ErrorCategory
  public readonly severity: ErrorSeverity
  public readonly code: string
  public readonly context: ErrorContext
  public readonly retryable: boolean
  public readonly userFriendlyMessage: string

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    code?: string,
    context: ErrorContext = {},
    retryable: boolean = false,
    userFriendlyMessage?: string
  ) {
    super(message)
    this.name = 'JobTrackerError'
    this.id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    this.category = category
    this.severity = severity
    this.code = code || `${category.toUpperCase()}_ERROR`
    this.context = {
      ...context,
      timestamp: new Date().toISOString()
    }
    this.retryable = retryable
    this.userFriendlyMessage = userFriendlyMessage || this.getDefaultUserMessage()
  }

  private getDefaultUserMessage(): string {
    switch (this.category) {
      case ErrorCategory.AUTHENTICATION:
        return 'Authentication failed. Please log in again.'
      case ErrorCategory.AUTHORIZATION:
        return 'You do not have permission to perform this action.'
      case ErrorCategory.VALIDATION:
        return 'The provided information is invalid. Please check your input.'
      case ErrorCategory.DATABASE:
        return 'A database error occurred. Please try again.'
      case ErrorCategory.EXTERNAL_API:
        return 'An external service is unavailable. Please try again later.'
      case ErrorCategory.BUSINESS_LOGIC:
        return 'This action cannot be completed due to business rules.'
      case ErrorCategory.SYSTEM:
        return 'A system error occurred. Our team has been notified.'
      case ErrorCategory.PERFORMANCE:
        return 'The request is taking longer than expected. Please try again.'
      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }

  toJSON(): ApplicationError {
    return {
      id: this.id,
      message: this.message,
      category: this.category,
      severity: this.severity,
      code: this.code,
      context: this.context,
      stack: this.stack,
      cause: this.cause,
      retryable: this.retryable,
      userFriendlyMessage: this.userFriendlyMessage
    }
  }
}

// Specific error classes for common scenarios
export class AuthenticationError extends JobTrackerError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCategory.AUTHENTICATION,
      ErrorSeverity.HIGH,
      'AUTH_FAILED',
      context,
      false,
      'Authentication failed. Please log in again.'
    )
  }
}

export class AuthorizationError extends JobTrackerError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCategory.AUTHORIZATION,
      ErrorSeverity.HIGH,
      'ACCESS_DENIED',
      context,
      false,
      'You do not have permission to perform this action.'
    )
  }
}

export class ValidationError extends JobTrackerError {
  constructor(message: string, context: ErrorContext = {}) {
    super(
      message,
      ErrorCategory.VALIDATION,
      ErrorSeverity.MEDIUM,
      'VALIDATION_FAILED',
      context,
      false,
      'The provided information is invalid. Please check your input.'
    )
  }
}

export class DatabaseError extends JobTrackerError {
  constructor(message: string, context: ErrorContext = {}, retryable: boolean = true) {
    super(
      message,
      ErrorCategory.DATABASE,
      ErrorSeverity.HIGH,
      'DATABASE_ERROR',
      context,
      retryable,
      'A database error occurred. Please try again.'
    )
  }
}

export class BusinessLogicError extends JobTrackerError {
  constructor(message: string, context: ErrorContext = {}, userMessage?: string) {
    super(
      message,
      ErrorCategory.BUSINESS_LOGIC,
      ErrorSeverity.MEDIUM,
      'BUSINESS_RULE_VIOLATION',
      context,
      false,
      userMessage || 'This action cannot be completed due to business rules.'
    )
  }
}

// =============================================
// Error Logging System
// =============================================

export class ErrorLogger {
  private static instance: ErrorLogger
  private logBuffer: ApplicationError[] = []
  private batchSize = 10
  private flushInterval = 5000 // 5 seconds

  private constructor() {
    // Start periodic flush
    if (typeof window === 'undefined') {
      setInterval(() => this.flushLogs(), this.flushInterval)
    }
  }

  public static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger()
    }
    return ErrorLogger.instance
  }

  /**
   * Log an error with automatic categorization and context enrichment
   */
  public async logError(error: Error | JobTrackerError, context: ErrorContext = {}): Promise<void> {
    try {
      let applicationError: ApplicationError

      if (error instanceof JobTrackerError) {
        applicationError = {
          ...error.toJSON(),
          context: { ...error.context, ...context }
        }
      } else {
        // Convert standard Error to ApplicationError
        applicationError = {
          id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message: error.message,
          category: this.categorizeError(error),
          severity: this.determineSeverity(error),
          code: error.name || 'UNKNOWN_ERROR',
          context: {
            ...context,
            timestamp: new Date().toISOString()
          },
          stack: error.stack,
          cause: error.cause as Error,
          retryable: this.isRetryable(error),
          userFriendlyMessage: 'An unexpected error occurred. Please try again.'
        }
      }

      // Add to buffer for batch processing
      this.logBuffer.push(applicationError)

      // Console log for development
      if (process.env.NODE_ENV === 'development') {
        console.error(`[${applicationError.severity.toUpperCase()}] ${applicationError.category}:`, {
          message: applicationError.message,
          code: applicationError.code,
          context: applicationError.context,
          stack: applicationError.stack
        })
      }

      // Immediate flush for critical errors
      if (applicationError.severity === ErrorSeverity.CRITICAL) {
        await this.flushLogs()
      }

      // Batch flush when buffer is full
      if (this.logBuffer.length >= this.batchSize) {
        await this.flushLogs()
      }

    } catch (loggingError) {
      // Fallback: at least log to console if database logging fails
      console.error('Error logging failed:', loggingError)
      console.error('Original error:', error)
    }
  }

  /**
   * Flush buffered logs to database
   */
  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return

    const logsToFlush = [...this.logBuffer]
    this.logBuffer = []

    try {
      // Insert errors into database
      const { error } = await supabase
        .from('error_logs')
        .insert(
          logsToFlush.map(log => ({
            id: log.id,
            message: log.message,
            category: log.category,
            severity: log.severity,
            code: log.code,
            context: log.context,
            stack_trace: log.stack,
            retryable: log.retryable,
            user_friendly_message: log.userFriendlyMessage,
            company_id: log.context.companyId,
            user_id: log.context.userId
          }))
        )

      if (error) {
        console.error('Failed to flush error logs:', error)
        // Re-add to buffer for retry
        this.logBuffer.unshift(...logsToFlush)
      }

    } catch (flushError) {
      console.error('Error flushing logs:', flushError)
      // Re-add to buffer for retry
      this.logBuffer.unshift(...logsToFlush)
    }
  }

  /**
   * Automatically categorize errors based on their characteristics
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase()
    
    if (message.includes('auth') || message.includes('token') || message.includes('login')) {
      return ErrorCategory.AUTHENTICATION
    }
    
    if (message.includes('permission') || message.includes('forbidden') || message.includes('unauthorized')) {
      return ErrorCategory.AUTHORIZATION
    }
    
    if (message.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return ErrorCategory.VALIDATION
    }
    
    if (message.includes('database') || message.includes('sql') || message.includes('postgres')) {
      return ErrorCategory.DATABASE
    }
    
    if (message.includes('fetch') || message.includes('network') || message.includes('api')) {
      return ErrorCategory.EXTERNAL_API
    }
    
    if (message.includes('timeout') || message.includes('slow') || message.includes('performance')) {
      return ErrorCategory.PERFORMANCE
    }

    return ErrorCategory.SYSTEM
  }

  /**
   * Determine error severity based on error characteristics
   */
  private determineSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()
    
    if (message.includes('critical') || message.includes('fatal') || message.includes('crash')) {
      return ErrorSeverity.CRITICAL
    }
    
    if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
      return ErrorSeverity.HIGH
    }
    
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorSeverity.MEDIUM
    }

    return ErrorSeverity.LOW
  }

  /**
   * Determine if error is retryable
   */
  private isRetryable(error: Error): boolean {
    const message = error.message.toLowerCase()
    
    // Non-retryable errors
    if (
      message.includes('auth') ||
      message.includes('permission') ||
      message.includes('validation') ||
      message.includes('invalid')
    ) {
      return false
    }
    
    // Retryable errors
    if (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('database') ||
      message.includes('service unavailable')
    ) {
      return true
    }

    return false
  }
}

// =============================================
// Error Handling Utilities
// =============================================

/**
 * Extract context from Next.js request
 */
export function extractRequestContext(request: NextRequest): ErrorContext {
  return {
    url: request.url,
    method: request.method,
    userAgent: request.headers.get('user-agent') || undefined,
    ipAddress: request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown',
    requestId: request.headers.get('x-request-id') || undefined
  }
}

/**
 * Global error handler for API routes
 */
export async function handleApiError(
  error: Error,
  request: NextRequest,
  additionalContext: Record<string, any> = {}
): Promise<Response> {
  const context: ErrorContext = {
    ...extractRequestContext(request),
    ...additionalContext
  }

  const logger = ErrorLogger.getInstance()
  await logger.logError(error, context)

  // Return appropriate error response
  if (error instanceof JobTrackerError) {
    const statusCode = getHttpStatusCode(error.category)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          message: error.userFriendlyMessage,
          code: error.code,
          retryable: error.retryable,
          id: error.id
        }
      }),
      {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  // Generic error response
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message: 'An unexpected error occurred. Please try again.',
        code: 'INTERNAL_SERVER_ERROR',
        retryable: true
      }
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Get appropriate HTTP status code for error category
 */
function getHttpStatusCode(category: ErrorCategory): number {
  switch (category) {
    case ErrorCategory.AUTHENTICATION:
      return 401
    case ErrorCategory.AUTHORIZATION:
      return 403
    case ErrorCategory.VALIDATION:
      return 400
    case ErrorCategory.DATABASE:
    case ErrorCategory.EXTERNAL_API:
    case ErrorCategory.SYSTEM:
      return 500
    case ErrorCategory.BUSINESS_LOGIC:
      return 422
    case ErrorCategory.PERFORMANCE:
      return 408
    default:
      return 500
  }
}

/**
 * Wrapper for async functions with automatic error handling
 */
export function withErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context: ErrorContext = {}
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      const logger = ErrorLogger.getInstance()
      await logger.logError(error as Error, context)
      throw error
    }
  }
}

/**
 * Performance monitoring wrapper
 */
export function withPerformanceMonitoring<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operationName: string,
  warningThresholdMs: number = 1000
) {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now()
    
    try {
      const result = await fn(...args)
      const duration = Date.now() - startTime
      
      if (duration > warningThresholdMs) {
        const logger = ErrorLogger.getInstance()
        await logger.logError(
          new JobTrackerError(
            `Operation ${operationName} took ${duration}ms`,
            ErrorCategory.PERFORMANCE,
            ErrorSeverity.MEDIUM,
            'SLOW_OPERATION',
            { operationName, duration, warningThresholdMs }
          )
        )
      }
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      const logger = ErrorLogger.getInstance()
      
      await logger.logError(error as Error, {
        operationName,
        duration,
        performanceImpact: 'operation_failed'
      })
      
      throw error
    }
  }
}

// =============================================
// Business Rule Validation
// =============================================

/**
 * Validates business rules and throws appropriate errors
 */
export async function validateBusinessRule(
  condition: boolean | Promise<boolean>,
  message: string,
  code?: string,
  context?: Record<string, any>
): Promise<void> {
  const result = await Promise.resolve(condition)
  
  if (!result) {
    throw new BusinessLogicError(message, code, context)
  }
}

// =============================================
// Singleton Export
// =============================================

export const errorLogger = ErrorLogger.getInstance()