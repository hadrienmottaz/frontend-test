/**
 * Adaptive Concurrency Manager
 * Automatically optimizes upload concurrency based on throughput measurements
 */

/**
 * @typedef {Object} ThroughputMetrics
 * @property {number} bytesPerSecond - Current throughput in bytes/second
 * @property {number} concurrency - Current concurrency level
 * @property {number} completedTasks - Number of completed tasks
 * @property {string} trend - 'increasing' | 'decreasing' | 'stable'
 */

/**
 * @typedef {Object} AdaptiveConcurrencyConfig
 * @property {number} minConcurrency - Minimum concurrent uploads (default: 1)
 * @property {number} maxConcurrency - Maximum concurrent uploads (default: 8)
 * @property {number} initialConcurrency - Starting concurrency (default: 2)
 * @property {number} measurementWindow - Number of tasks to complete before measuring (default: 2)
 * @property {number} increaseThreshold - Throughput improvement % to increase (default: 5)
 * @property {number} decreaseThreshold - Throughput degradation % to decrease (default: -10)
 * @property {number} stabilityCount - Consecutive stable measurements before testing higher (default: 3)
 */

const DEFAULT_CONFIG = {
  minConcurrency: 1,
  maxConcurrency: 8,
  initialConcurrency: 2,
  measurementWindow: 2,
  increaseThreshold: 5,
  decreaseThreshold: -10,
  stabilityCount: 3
};

/**
 * Creates an adaptive concurrency controller
 * @param {AdaptiveConcurrencyConfig} config - Configuration options
 * @returns {Object} Controller instance
 */
export const createAdaptiveConcurrencyController = (config = {}) => {
  const settings = { ...DEFAULT_CONFIG, ...config };
  
  let concurrency = settings.initialConcurrency;
  let completedInWindow = 0;
  let bytesInWindow = 0;
  let windowStartTime = Date.now();
  let lastThroughput = 0;
  let bestThroughput = 0;
  let stableCount = 0;
  let lastAdjustment = 'increase';
  let totalBytesUploaded = 0;
  let totalTimeElapsed = 0;
  let startTime = Date.now();

  const reset = () => {
    concurrency = settings.initialConcurrency;
    completedInWindow = 0;
    bytesInWindow = 0;
    windowStartTime = Date.now();
    lastThroughput = 0;
    bestThroughput = 0;
    stableCount = 0;
    lastAdjustment = 'increase';
    totalBytesUploaded = 0;
    totalTimeElapsed = 0;
    startTime = Date.now();
  };

  const recordCompletion = (bytes) => {
    completedInWindow++;
    bytesInWindow += bytes;
    totalBytesUploaded += bytes;
    totalTimeElapsed = (Date.now() - startTime) / 1000;
  };

  const shouldMeasure = () => {
    return completedInWindow >= settings.measurementWindow;
  };

  const measureAndAdjust = (onAdjust = null) => {
    if (!shouldMeasure()) {
      return null;
    }

    const windowDuration = (Date.now() - windowStartTime) / 1000;
    const currentThroughput = bytesInWindow / windowDuration;
    
    const result = {
      throughput: currentThroughput,
      previousThroughput: lastThroughput,
      concurrency,
      adjusted: false,
      direction: null
    };

    // Calculate improvement percentage
    const improvementPercent = lastThroughput > 0 
      ? ((currentThroughput - lastThroughput) / lastThroughput) * 100 
      : 100; // First measurement, assume improvement

    // Track best throughput
    if (currentThroughput > bestThroughput) {
      bestThroughput = currentThroughput;
      stableCount = 0;
    } else {
      stableCount++;
    }

    // Decision logic
    if (improvementPercent > settings.increaseThreshold) {
      // Throughput improved - try increasing if we were increasing
      if (lastAdjustment === 'increase' && concurrency < settings.maxConcurrency) {
        concurrency = Math.min(concurrency + 1, settings.maxConcurrency);
        result.adjusted = true;
        result.direction = 'increase';
        if (onAdjust) {
          onAdjust('increase', concurrency, currentThroughput);
        }
      }
    } else if (improvementPercent < settings.decreaseThreshold && stableCount >= 2) {
      // Throughput degraded significantly - decrease
      if (concurrency > settings.minConcurrency) {
        concurrency = Math.max(concurrency - 1, settings.minConcurrency);
        lastAdjustment = 'decrease';
        result.adjusted = true;
        result.direction = 'decrease';
        stableCount = 0;
        if (onAdjust) {
          onAdjust('decrease', concurrency, currentThroughput);
        }
      }
    } else if (stableCount >= settings.stabilityCount && concurrency < settings.maxConcurrency) {
      // Stable for a while - cautiously try increasing
      concurrency = Math.min(concurrency + 1, settings.maxConcurrency);
      lastAdjustment = 'increase';
      result.adjusted = true;
      result.direction = 'probe';
      stableCount = 0;
      if (onAdjust) {
        onAdjust('probe', concurrency, currentThroughput);
      }
    }

    // Update tracking
    lastThroughput = currentThroughput;
    
    // Reset window
    completedInWindow = 0;
    bytesInWindow = 0;
    windowStartTime = Date.now();

    return result;
  };

  const getConcurrency = () => concurrency;
  
  const getMetrics = () => ({
    concurrency,
    currentThroughput: lastThroughput,
    bestThroughput,
    totalBytesUploaded,
    averageThroughput: totalTimeElapsed > 0 ? totalBytesUploaded / totalTimeElapsed : 0,
    trend: lastAdjustment
  });

  return {
    reset,
    recordCompletion,
    shouldMeasure,
    measureAndAdjust,
    getConcurrency,
    getMetrics,
    getConfig: () => ({ ...settings })
  };
};

/**
 * Runs tasks with adaptive concurrency control
 * @param {Array<() => Promise<{bytes: number, result: any}>>} tasks - Array of task functions
 * @param {Object} options - Options
 * @param {AdaptiveConcurrencyConfig} options.config - Concurrency config
 * @param {function} options.onConcurrencyChange - Callback when concurrency changes
 * @param {function} options.onProgress - Progress callback (completed, total, throughput, concurrency)
 * @returns {Promise<Array>} Results array
 */
export const runWithAdaptiveConcurrency = async (tasks, options = {}) => {
  const { config = {}, onConcurrencyChange, onProgress } = options;
  
  const controller = createAdaptiveConcurrencyController(config);
  const results = new Array(tasks.length);
  let taskIndex = 0;
  let completedCount = 0;

  const executeTask = async (index) => {
    try {
      const taskResult = await tasks[index]();
      const bytes = taskResult.bytes || 0;
      
      controller.recordCompletion(bytes);
      completedCount++;
      
      // Check if we should measure and adjust
      const adjustment = controller.measureAndAdjust((direction, newConcurrency, throughput) => {
        if (onConcurrencyChange) {
          onConcurrencyChange(direction, newConcurrency, throughput);
        }
      });

      // Report progress
      if (onProgress) {
        const metrics = controller.getMetrics();
        onProgress(completedCount, tasks.length, metrics.averageThroughput, controller.getConcurrency());
      }

      results[index] = taskResult.result;
      return taskResult;
    } catch (error) {
      results[index] = { error };
      completedCount++;
      throw error;
    }
  };

  const worker = async () => {
    while (taskIndex < tasks.length) {
      // Get current concurrency dynamically
      const currentIndex = taskIndex++;
      if (currentIndex >= tasks.length) break;
      
      try {
        await executeTask(currentIndex);
      } catch (error) {
        // Task failed, continue with others
        console.error(`Task ${currentIndex} failed:`, error);
      }
    }
  };

  // Start initial workers based on initial concurrency
  const initialConcurrency = controller.getConcurrency();
  const workers = [];
  
  for (let i = 0; i < Math.min(initialConcurrency, tasks.length); i++) {
    workers.push(worker());
  }

  // Monitor and spawn additional workers if concurrency increases
  const monitorInterval = setInterval(() => {
    const targetConcurrency = controller.getConcurrency();
    const activeWorkers = workers.filter(w => w !== null).length;
    
    // Spawn additional workers if needed
    while (workers.length < targetConcurrency && taskIndex < tasks.length) {
      workers.push(worker());
    }
  }, 100);

  try {
    await Promise.all(workers);
  } finally {
    clearInterval(monitorInterval);
  }

  return {
    results,
    metrics: controller.getMetrics()
  };
};

/**
 * Formats bytes per second into human-readable string
 * @param {number} bytesPerSecond - Throughput in bytes/second
 * @returns {string} Formatted string (e.g., "2.5 MB/s")
 */
export const formatThroughput = (bytesPerSecond) => {
  if (bytesPerSecond === 0) return '0 B/s';
  
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let value = bytesPerSecond;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

/**
 * Formats bytes into human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted string (e.g., "2.5 MB")
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

export default {
  createAdaptiveConcurrencyController,
  runWithAdaptiveConcurrency,
  formatThroughput,
  formatBytes
};
