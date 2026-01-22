import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Configuration persistence hook for localStorage
 */
export const useConfig = (defaultConfig = {}) => {
  const [config, setConfig] = useState({
    apiBaseUrl: defaultConfig.apiBaseUrl || 'https://www.cognex.com/api',
    projectId: defaultConfig.projectId || '',
    bearerToken: defaultConfig.bearerToken || ''
  });
  const [configSaved, setConfigSaved] = useState(false);

  // Auto-load on mount
  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveConfig = useCallback(() => {
    localStorage.setItem('imageUploaderConfig', JSON.stringify(config));
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  }, [config]);

  const loadConfig = useCallback(() => {
    const savedConfig = localStorage.getItem('imageUploaderConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(prev => ({
          ...prev,
          ...parsed
        }));
      } catch (error) {
        console.error('Error loading saved configuration:', error);
      }
    }
  }, []);

  const updateConfig = useCallback((key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    config,
    configSaved,
    saveConfig,
    loadConfig,
    updateConfig
  };
};

/**
 * File selection and preview management hook
 * Optimized for large file counts - no longer generates all previews upfront
 */
export const useFileSelection = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);

  const handleFileSelect = useCallback((files) => {
    const fileArray = Array.from(files);
    setSelectedFiles(fileArray);
    // Preview URLs are now generated lazily by ImagePreviewItem
  }, []);

  const clearFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  return {
    selectedFiles,
    handleFileSelect,
    clearFiles
  };
};

/**
 * Upload progress tracking hook
 */
export const useUploadProgress = (fileCount) => {
  const [fileProgress, setFileProgress] = useState({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  
  // Throughput tracking
  const [currentThroughput, setCurrentThroughput] = useState(0);
  const bytesTracker = useRef({ uploaded: 0, lastCheck: Date.now() });

  // Track elapsed time
  useEffect(() => {
    let interval;
    if (uploadStartTime) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - uploadStartTime) / 1000;
        setElapsedTime(elapsed);
        
        if (overallProgress > 0 && overallProgress < 100) {
          const estimatedTotal = elapsed / (overallProgress / 100);
          const remaining = estimatedTotal - elapsed;
          setEstimatedTimeRemaining(Math.max(0, remaining));
        }
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [uploadStartTime, overallProgress]);

  const startTracking = useCallback(() => {
    setUploadStartTime(Date.now());
    setElapsedTime(0);
    setEstimatedTimeRemaining(0);
    setFileProgress({});
    setOverallProgress(0);
    setCurrentThroughput(0);
    bytesTracker.current = { uploaded: 0, lastCheck: Date.now() };
  }, []);

  const updateFileProgress = useCallback((index, progress, status) => {
    setFileProgress(prev => ({
      ...prev,
      [index]: { progress, status }
    }));
  }, []);

  const recalculateOverallProgress = useCallback((progressMap, totalFiles) => {
    const totalProgress = Object.values(progressMap).reduce(
      (sum, item) => sum + (item.progress || 0), 
      0
    );
    const avgProgress = totalProgress / totalFiles;
    setOverallProgress(avgProgress);
  }, []);

  const updateThroughput = useCallback((bytesUploaded) => {
    const now = Date.now();
    bytesTracker.current.uploaded += bytesUploaded;
    
    const timeDelta = (now - bytesTracker.current.lastCheck) / 1000;
    if (timeDelta >= 0.5) { // Update every 500ms
      const throughput = bytesTracker.current.uploaded / ((now - uploadStartTime) / 1000);
      setCurrentThroughput(throughput);
      bytesTracker.current.lastCheck = now;
    }
  }, [uploadStartTime]);

  const resetProgress = useCallback(() => {
    setFileProgress({});
    setOverallProgress(0);
    setElapsedTime(0);
    setEstimatedTimeRemaining(0);
    setCurrentThroughput(0);
    setUploadStartTime(null);
  }, []);

  return {
    fileProgress,
    overallProgress,
    elapsedTime,
    estimatedTimeRemaining,
    currentThroughput,
    uploadStartTime,
    startTracking,
    updateFileProgress,
    recalculateOverallProgress,
    updateThroughput,
    resetProgress,
    setOverallProgress,
    setFileProgress
  };
};

/**
 * Upload status messages hook
 */
export const useUploadStatus = () => {
  const [statuses, setStatuses] = useState([]);

  const addStatus = useCallback((message, type = 'info') => {
    setStatuses(prev => [...prev, { message, type }]);
  }, []);

  const clearStatuses = useCallback(() => {
    setStatuses([]);
  }, []);

  return {
    statuses,
    addStatus,
    clearStatuses,
    setStatuses
  };
};
