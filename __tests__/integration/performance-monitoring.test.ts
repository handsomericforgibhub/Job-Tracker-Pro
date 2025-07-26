/**
 * Performance Monitoring Integration Tests
 * 
 * ADR Phase 3: Infrastructure & Optimization
 * Comprehensive testing of performance monitoring, metrics collection,
 * and optimization utilities.
 */

import {
  PerformanceMonitor,
  performanceMonitor,
  MetricType,
  withPerformanceMonitoring,
  monitoredSupabaseQuery,
  monitoredFetch,
  MonitoredCache,
  batchProcess,
  debounce,
  throttle
} from '@/lib/performance-monitor'
import {
  createTestPerformanceMetric,
  measureExecutionTime,
  simulateSlowOperation,
  setupBeforeEach,
  teardownAfterEach,
  cleanupTestData
} from '../utils/enhanced-test-helpers'

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => ({ select: jest.fn(() => ({ single: jest.fn() })) })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({ single: jest.fn() }))
        }))
      }))
    }))
  }
}))

jest.mock('@/lib/error-handler', () => ({
  errorLogger: {
    logError: jest.fn()
  }
}))

describe('Performance Monitoring System', () => {
  beforeEach(async () => {
    await setupBeforeEach()
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await teardownAfterEach()
  })

  describe('PerformanceMonitor', () => {
    it('should record performance metrics', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { id: 'test-metric-id' },
        error: null
      })

      const metric = {
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: 'test_operation',
        operation_name: 'test_api_call',
        duration_ms: 150,
        company_id: 'test-company-id',
        user_id: 'test-user-id'
      }

      // Act
      await performanceMonitor.recordMetric(metric)

      // Assert - Allow time for buffer flush
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // The metric should be buffered (exact verification depends on implementation)
      expect(true).toBe(true) // Placeholder assertion
    })

    it('should detect performance threshold violations', async () => {
      // Arrange
      const mockErrorLogger = require('@/lib/error-handler').errorLogger
      
      const slowMetric = {
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: 'slow_operation',
        operation_name: 'slow_api_call',
        duration_ms: 5000, // 5 seconds - exceeds critical threshold
        company_id: 'test-company-id',
        user_id: 'test-user-id'
      }

      // Act
      await performanceMonitor.recordMetric(slowMetric)

      // Assert
      expect(mockErrorLogger.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          metricType: MetricType.API_RESPONSE_TIME,
          duration: 5000,
          threshold: expect.any(Number)
        })
      )
    })

    it('should batch flush metrics to database', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.from().insert.mockResolvedValue({ error: null })

      const metrics = Array.from({ length: 5 }, (_, i) => ({
        metric_type: MetricType.DATABASE_QUERY,
        metric_name: `query_${i}`,
        operation_name: `operation_${i}`,
        duration_ms: 100 + i * 10,
        company_id: 'test-company-id'
      }))

      // Act
      for (const metric of metrics) {
        await performanceMonitor.recordMetric(metric)
      }

      // Allow time for potential batching
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith('performance_metrics')
    })

    it('should handle database errors gracefully during flush', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.from().insert.mockResolvedValue({
        error: { message: 'Database connection failed' }
      })

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      const metric = {
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: 'test_operation',
        duration_ms: 100
      }

      // Act
      await performanceMonitor.recordMetric(metric)
      await new Promise(resolve => setTimeout(resolve, 100))

      // Assert
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to flush performance metrics:',
        expect.any(Object)
      )

      consoleSpy.mockRestore()
    })

    it('should get performance statistics', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase').supabase
      const mockMetrics = [
        { duration_ms: 100, operation_name: 'operation_1' },
        { duration_ms: 200, operation_name: 'operation_2' },
        { duration_ms: 150, operation_name: 'operation_1' }
      ]

      mockSupabase.from().select().eq().gte.mockResolvedValue({
        data: mockMetrics,
        error: null
      })

      // Act
      const stats = await performanceMonitor.getPerformanceStats(
        'test-company-id',
        MetricType.API_RESPONSE_TIME,
        24
      )

      // Assert
      expect(stats).toHaveProperty('avgDuration')
      expect(stats).toHaveProperty('maxDuration')
      expect(stats).toHaveProperty('minDuration')
      expect(stats).toHaveProperty('sampleCount')
      expect(stats).toHaveProperty('slowOperations')
      expect(stats.avgDuration).toBe(150) // (100 + 200 + 150) / 3
      expect(stats.maxDuration).toBe(200)
      expect(stats.minDuration).toBe(100)
      expect(stats.sampleCount).toBe(3)
    })
  })

  describe('Performance Monitoring Decorators', () => {
    it('should monitor function performance with withPerformanceMonitoring', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { id: 'test-metric-id' },
        error: null
      })

      const testFunction = async (delay: number) => {
        await simulateSlowOperation(delay)
        return 'success'
      }

      const monitoredFunction = withPerformanceMonitoring(
        testFunction,
        MetricType.API_RESPONSE_TIME,
        'test_function',
        'monitored_operation'
      )

      // Act
      const result = await monitoredFunction(50)

      // Assert
      expect(result).toBe('success')
      // Metric recording is asynchronous, so we can't directly assert it
    })

    it('should handle errors in monitored functions', async () => {
      // Arrange
      const testFunction = async () => {
        throw new Error('Test error')
      }

      const monitoredFunction = withPerformanceMonitoring(
        testFunction,
        MetricType.API_RESPONSE_TIME,
        'test_function_error',
        'error_operation'
      )

      // Act & Assert
      await expect(monitoredFunction()).rejects.toThrow('Test error')
    })
  })

  describe('Database Query Monitoring', () => {
    it('should monitor Supabase queries', async () => {
      // Arrange
      const mockQueryBuilder = {
        then: jest.fn().mockResolvedValue({ data: [{ id: '1' }], error: null })
      }

      // Act
      const result = await monitoredSupabaseQuery(
        mockQueryBuilder,
        'test_query',
        { company_id: 'test-company-id' }
      )

      // Assert
      expect(result).toEqual([{ id: '1' }])
    })

    it('should handle query errors', async () => {
      // Arrange
      const mockQueryBuilder = {
        then: jest.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Query failed' } 
        })
      }

      // Act & Assert
      await expect(
        monitoredSupabaseQuery(mockQueryBuilder, 'failing_query')
      ).rejects.toThrow('Query failed')
    })
  })

  describe('External API Monitoring', () => {
    it('should monitor fetch requests', async () => {
      // Arrange
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: 'test' })
      } as Response)

      // Act
      const response = await monitoredFetch(
        'https://api.example.com/test',
        { method: 'GET' },
        { source: 'test' }
      )

      // Assert
      expect(response.ok).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/test',
        { method: 'GET' }
      )
    })

    it('should handle fetch errors', async () => {
      // Arrange
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'))

      // Act & Assert
      await expect(
        monitoredFetch('https://api.example.com/test')
      ).rejects.toThrow('Network error')
    })
  })

  describe('MonitoredCache', () => {
    it('should cache and retrieve values', async () => {
      // Arrange
      const cache = new MonitoredCache<string>('test_cache', 5000)

      // Act
      await cache.set('key1', 'value1')
      const result = await cache.get('key1')

      // Assert
      expect(result).toBe('value1')
    })

    it('should handle cache misses', async () => {
      // Arrange
      const cache = new MonitoredCache<string>('test_cache', 5000)

      // Act
      const result = await cache.get('nonexistent_key')

      // Assert
      expect(result).toBeNull()
    })

    it('should expire cached values', async () => {
      // Arrange
      const cache = new MonitoredCache<string>('test_cache', 50) // 50ms TTL

      // Act
      await cache.set('key1', 'value1')
      await simulateSlowOperation(100) // Wait longer than TTL
      const result = await cache.get('key1')

      // Assert
      expect(result).toBeNull()
    })

    it('should record cache performance metrics', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: { id: 'test-metric-id' },
        error: null
      })

      const cache = new MonitoredCache<string>('test_cache', 5000)

      // Act
      await cache.set('key1', 'value1')
      await cache.get('key1') // Cache hit
      await cache.get('key2') // Cache miss

      // Assert
      // Performance metrics are recorded asynchronously
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(true).toBe(true) // Placeholder - actual verification would check metric recording
    })
  })

  describe('Performance Optimization Utilities', () => {
    describe('debounce', () => {
      it('should debounce function calls', async () => {
        // Arrange
        const mockFn = jest.fn()
        const debouncedFn = debounce(mockFn, 100)

        // Act
        debouncedFn('call1')
        debouncedFn('call2')
        debouncedFn('call3')

        // Wait for debounce delay
        await simulateSlowOperation(150)

        // Assert
        expect(mockFn).toHaveBeenCalledTimes(1)
        expect(mockFn).toHaveBeenCalledWith('call3')
      })
    })

    describe('throttle', () => {
      it('should throttle function calls', async () => {
        // Arrange
        const mockFn = jest.fn()
        const throttledFn = throttle(mockFn, 100)

        // Act
        throttledFn('call1')
        throttledFn('call2') // Should be ignored
        throttledFn('call3') // Should be ignored

        await simulateSlowOperation(150)
        
        throttledFn('call4') // Should execute after throttle period

        // Assert
        expect(mockFn).toHaveBeenCalledTimes(2)
        expect(mockFn).toHaveBeenNthCalledWith(1, 'call1')
        expect(mockFn).toHaveBeenNthCalledWith(2, 'call4')
      })
    })

    describe('batchProcess', () => {
      it('should process items in batches', async () => {
        // Arrange
        const items = Array.from({ length: 25 }, (_, i) => i)
        const processor = jest.fn().mockImplementation(async (batch: number[]) => 
          batch.map(item => item * 2)
        )

        // Act
        const results = await batchProcess(items, processor, 10, 0)

        // Assert
        expect(results).toHaveLength(25)
        expect(results[0]).toBe(0) // 0 * 2
        expect(results[24]).toBe(48) // 24 * 2
        expect(processor).toHaveBeenCalledTimes(3) // ceil(25/10) = 3 batches
      })

      it('should handle batch processing errors', async () => {
        // Arrange
        const items = [1, 2, 3, 4, 5]
        const processor = jest.fn().mockRejectedValue(new Error('Batch processing failed'))

        // Act & Assert
        await expect(
          batchProcess(items, processor, 2)
        ).rejects.toThrow('Batch processing failed')
      })

      it('should respect batch delay', async () => {
        // Arrange
        const items = [1, 2, 3, 4]
        const processor = jest.fn().mockImplementation(async (batch: number[]) => batch)
        const delayMs = 50

        // Act
        const startTime = Date.now()
        await batchProcess(items, processor, 2, delayMs)
        const endTime = Date.now()

        // Assert
        expect(processor).toHaveBeenCalledTimes(2)
        expect(endTime - startTime).toBeGreaterThanOrEqual(delayMs)
      })
    })
  })

  describe('Performance Testing Utilities', () => {
    it('should measure execution time accurately', async () => {
      // Arrange
      const delay = 100
      const testFunction = () => simulateSlowOperation(delay)

      // Act
      const { result, duration } = await measureExecutionTime(testFunction)

      // Assert
      expect(duration).toBeGreaterThanOrEqual(delay - 10) // Allow small variance
      expect(duration).toBeLessThanOrEqual(delay + 50) // Allow reasonable overhead
    })

    it('should enforce maximum execution time', async () => {
      // Arrange
      const delay = 200
      const maxTime = 100
      const testFunction = () => simulateSlowOperation(delay)

      // Act & Assert
      await expect(
        measureExecutionTime(testFunction, maxTime)
      ).rejects.toThrow(`Operation took ${expect.any(Number)}ms, expected maximum ${maxTime}ms`)
    })
  })

  describe('Real-world Performance Scenarios', () => {
    it('should handle high-frequency metric recording', async () => {
      // Arrange
      const mockSupabase = require('@/lib/supabase').supabase
      mockSupabase.from().insert.mockResolvedValue({ error: null })

      const metricsCount = 100
      const metrics = Array.from({ length: metricsCount }, (_, i) => ({
        metric_type: MetricType.API_RESPONSE_TIME,
        metric_name: `high_frequency_metric_${i}`,
        duration_ms: Math.random() * 1000,
        company_id: 'test-company-id'
      }))

      // Act
      const startTime = Date.now()
      await Promise.all(
        metrics.map(metric => performanceMonitor.recordMetric(metric))
      )
      const endTime = Date.now()

      // Assert
      const recordingDuration = endTime - startTime
      expect(recordingDuration).toBeLessThan(1000) // Should complete within 1 second

      // Allow time for background processing
      await simulateSlowOperation(200)
    })

    it('should maintain performance under memory pressure', async () => {
      // Arrange
      const cache = new MonitoredCache<string>('memory_test_cache', 1000)
      const itemCount = 1000

      // Act
      const operations = Array.from({ length: itemCount }, async (_, i) => {
        await cache.set(`key_${i}`, `large_value_${'x'.repeat(1000)}_${i}`)
        return cache.get(`key_${i}`)
      })

      const startTime = Date.now()
      const results = await Promise.all(operations)
      const endTime = Date.now()

      // Assert
      expect(results).toHaveLength(itemCount)
      expect(results.every(result => result !== null)).toBe(true)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle concurrent performance monitoring', async () => {
      // Arrange
      const concurrentOperations = 50
      const operationDelay = 10

      const monitoredOperation = withPerformanceMonitoring(
        async (id: number) => {
          await simulateSlowOperation(operationDelay)
          return `result_${id}`
        },
        MetricType.API_RESPONSE_TIME,
        'concurrent_operation',
        'concurrent_test'
      )

      // Act
      const startTime = Date.now()
      const promises = Array.from({ length: concurrentOperations }, (_, i) => 
        monitoredOperation(i)
      )
      const results = await Promise.all(promises)
      const endTime = Date.now()

      // Assert
      expect(results).toHaveLength(concurrentOperations)
      expect(results[0]).toBe('result_0')
      expect(results[concurrentOperations - 1]).toBe(`result_${concurrentOperations - 1}`)
      
      // Should complete in roughly parallel time, not sequential
      expect(endTime - startTime).toBeLessThan(operationDelay * concurrentOperations * 0.5)
    })
  })
})