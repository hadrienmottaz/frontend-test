import React, { useState, useCallback, useRef } from 'react';
import './ImageUploader.css';

// Services and utilities
import apiService from '../services/api';
import { 
  createAdaptiveConcurrencyController, 
  formatThroughput 
} from '../utils/adaptiveConcurrency';

// Hooks
import { 
  useConfig, 
  useFileSelection, 
  useUploadProgress, 
  useUploadStatus 
} from '../hooks/useUpload';

// Sub-components
import {
  ConfigSection,
  ProgressSection,
  ImagePreviewGrid,
  FileSelector
} from './upload';

/**
 * Modular Image Uploader Component
 * Handles image upload to Azure blob storage with adaptive concurrency optimization
 */
const ImageUploader = ({ apiServiceOverride = null }) => {
  // Use provided API service or default
  const api = apiServiceOverride || apiService;

  // Configuration
  const { 
    config, 
    configSaved, 
    saveConfig, 
    loadConfig, 
    updateConfig 
  } = useConfig();

  // File management
  const { 
    selectedFiles, 
    handleFileSelect, 
    clearFiles 
  } = useFileSelection();

  // Progress tracking
  const {
    fileProgress,
    overallProgress,
    elapsedTime,
    estimatedTimeRemaining,
    currentThroughput,
    startTracking,
    updateFileProgress,
    recalculateOverallProgress,
    updateThroughput,
    resetProgress,
    setOverallProgress,
    setFileProgress
  } = useUploadProgress(selectedFiles.length);

  // Status messages
  const { 
    statuses, 
    addStatus, 
    clearStatuses 
  } = useUploadStatus();

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [concurrency, setConcurrency] = useState(2);
  const [throughputDisplay, setThroughputDisplay] = useState(0);
  
  // Refs for tracking
  const progressMapRef = useRef({});
  const statusesRef = useRef([]);
  const totalBytesRef = useRef(0);
  const uploadStartTimeRef = useRef(null);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Handle file selection
  const onFileSelect = useCallback((files) => {
    handleFileSelect(files);
    resetProgress();
    clearStatuses();
  }, [handleFileSelect, resetProgress, clearStatuses]);

  // Handle clear
  const handleClear = useCallback(() => {
    clearFiles();
    resetProgress();
    clearStatuses();
  }, [clearFiles, resetProgress, clearStatuses]);

  // Handle cancel upload
  const handleCancelUpload = useCallback(() => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    addStatus('⚠ Upload cancelled by user', 'error');
  }, [addStatus]);

  // Upload a single file and register it
  const uploadAndRegisterFile = useCallback(async (file, index, blobInfo, addStatusMsg) => {
    // Upload to blob
    const uploadResult = await api.uploadToBlob(
      blobInfo.upload_url,
      file,
      (loaded, total) => {
        const percentComplete = (loaded / total) * 100;
        progressMapRef.current[index] = {
          progress: percentComplete,
          status: 'uploading'
        };
        setFileProgress({ ...progressMapRef.current });
        
        // Recalculate overall progress
        const totalProgress = Object.values(progressMapRef.current)
          .reduce((sum, item) => sum + (item.progress || 0), 0);
        setOverallProgress(totalProgress / selectedFiles.length);
      }
    );

    // Mark upload complete
    progressMapRef.current[index] = {
      progress: 100,
      status: 'completed'
    };
    setFileProgress({ ...progressMapRef.current });
    
    addStatusMsg(`✓ ${file.name} uploaded to blob storage`, 'success');

    // Register image
    addStatusMsg(`Registering ${file.name}...`, 'info');
    const imageData = await api.registerImage(
      config.apiBaseUrl,
      config.projectId,
      config.bearerToken,
      file.name,
      blobInfo.blob_url
    );
    addStatusMsg(`✓ Registered ${file.name}`, 'success');

    // Create sample with retry
    const sampleBaseName = file.name.replace(/\.[^/.]+$/, '');
    addStatusMsg(`Creating sample: ${sampleBaseName}...`, 'info');
    
    const sampleResult = await api.createSampleWithRetry(
      config.apiBaseUrl,
      config.projectId,
      config.bearerToken,
      sampleBaseName,
      imageData.image_id,
      10,
      (retryCount, newName) => {
        addStatusMsg(`⚠ Sample name conflict, retrying as: ${newName}`, 'info');
      }
    );
    
    addStatusMsg(`✓ Created sample: ${sampleResult.name}`, 'success');

    return {
      bytes: file.size,
      result: {
        fileName: file.name,
        blobUrl: blobInfo.blob_url,
        imageId: imageData.image_id,
        sampleId: sampleResult.sample_id,
        sampleName: sampleResult.name
      }
    };
  }, [api, config, selectedFiles.length, setFileProgress, setOverallProgress]);

  // Main upload handler
  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one image to upload');
      return;
    }

    if (!config.bearerToken.trim()) {
      alert('Please provide a bearer token');
      return;
    }

    if (!config.projectId.trim()) {
      alert('Please provide a project ID');
      return;
    }

    // Reset state
    setUploading(true);
    clearStatuses();
    progressMapRef.current = {};
    statusesRef.current = [];
    totalBytesRef.current = 0;
    uploadStartTimeRef.current = Date.now();
    cancelledRef.current = false;
    abortControllerRef.current = new AbortController();
    startTracking();
    setConcurrency(2);
    setThroughputDisplay(0);

    // Initialize progress
    selectedFiles.forEach((file, index) => {
      progressMapRef.current[index] = { progress: 0, status: 'pending' };
    });
    setFileProgress({ ...progressMapRef.current });

    // Helper to add status
    const addStatusMsg = (message, type) => {
      statusesRef.current = [...statusesRef.current, { message, type }];
      addStatus(message, type);
    };

    try {
      // Step 1: Create blob URLs
      addStatusMsg('Creating blob URLs...', 'info');
      
      const blobsData = await api.createBlobs(
        config.apiBaseUrl,
        config.projectId,
        config.bearerToken,
        selectedFiles.length
      );
      
      addStatusMsg(`Created ${blobsData.length} blob URL(s)`, 'success');

      // Create adaptive concurrency controller
      const concurrencyController = createAdaptiveConcurrencyController({
        initialConcurrency: 2,
        minConcurrency: 1,
        maxConcurrency: 8,
        measurementWindow: 2,
        increaseThreshold: 5,
        decreaseThreshold: -15,
        stabilityCount: 3
      });

      // Create upload tasks
      const results = new Array(selectedFiles.length);
      let taskIndex = 0;
      let completedCount = 0;

      const executeTask = async (index) => {
        const file = selectedFiles[index];
        const blobInfo = blobsData[index];

        if (!blobInfo || !blobInfo.upload_url) {
          throw new Error(`Missing upload URL for file ${index + 1}`);
        }

        addStatusMsg(`Starting upload: ${file.name}`, 'info');
        
        try {
          const taskResult = await uploadAndRegisterFile(file, index, blobInfo, addStatusMsg);
          
          // Record completion for throughput measurement
          concurrencyController.recordCompletion(taskResult.bytes);
          completedCount++;

          // Check for concurrency adjustment
          const adjustment = concurrencyController.measureAndAdjust((direction, newConcurrency, throughput) => {
            setConcurrency(newConcurrency);
            if (direction === 'increase') {
              addStatusMsg(`📈 Throughput improved, increasing concurrency to ${newConcurrency}`, 'info');
            } else if (direction === 'decrease') {
              addStatusMsg(`📉 Throughput decreased, reducing concurrency to ${newConcurrency}`, 'info');
            } else if (direction === 'probe') {
              addStatusMsg(`🔄 Testing higher concurrency: ${newConcurrency}`, 'info');
            }
          });

          // Update throughput display
          const metrics = concurrencyController.getMetrics();
          setThroughputDisplay(metrics.averageThroughput);
          updateThroughput(taskResult.bytes);

          results[index] = taskResult.result;
          return taskResult;
        } catch (error) {
          progressMapRef.current[index] = {
            progress: progressMapRef.current[index]?.progress || 0,
            status: 'error'
          };
          setFileProgress({ ...progressMapRef.current });
          addStatusMsg(`✗ Failed to process ${file.name}: ${error.message}`, 'error');
          throw error;
        }
      };

      const worker = async () => {
        while (taskIndex < selectedFiles.length && !cancelledRef.current) {
          const currentIndex = taskIndex++;
          if (currentIndex >= selectedFiles.length) break;
          if (cancelledRef.current) break;
          
          try {
            await executeTask(currentIndex);
          } catch (error) {
            if (cancelledRef.current) break;
            console.error(`Task ${currentIndex} failed:`, error);
          }
        }
      };

      // Start workers with dynamic concurrency
      const initialConcurrency = concurrencyController.getConcurrency();
      const workers = [];
      
      for (let i = 0; i < Math.min(initialConcurrency, selectedFiles.length); i++) {
        workers.push(worker());
      }

      // Monitor and spawn additional workers if concurrency increases
      const monitorInterval = setInterval(() => {
        if (cancelledRef.current) {
          clearInterval(monitorInterval);
          return;
        }
        const targetConcurrency = concurrencyController.getConcurrency();
        while (workers.length < targetConcurrency && taskIndex < selectedFiles.length && !cancelledRef.current) {
          workers.push(worker());
        }
      }, 100);

      try {
        await Promise.all(workers);
      } finally {
        clearInterval(monitorInterval);
      }

      // Complete (only if not cancelled)
      if (!cancelledRef.current) {
        setOverallProgress(100);
        const finalMetrics = concurrencyController.getMetrics();
        addStatusMsg(
          `🎉 Complete! All ${selectedFiles.length} image(s) uploaded. Average throughput: ${formatThroughput(finalMetrics.averageThroughput)}`,
          'success'
        );

        // Clear after delay
        setTimeout(() => {
          clearFiles();
          resetProgress();
        }, 3000);
      }

    } catch (error) {
      console.error('Error uploading images:', error);
      addStatusMsg(`Error: ${error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  }, [
    selectedFiles, 
    config, 
    api, 
    clearStatuses, 
    startTracking, 
    setFileProgress, 
    addStatus,
    uploadAndRegisterFile,
    updateThroughput,
    setOverallProgress,
    clearFiles,
    resetProgress
  ]);

  return (
    <div className="image-uploader">
      <h2>Image Uploader</h2>
      
      <ConfigSection
        apiBaseUrl={config.apiBaseUrl}
        projectId={config.projectId}
        bearerToken={config.bearerToken}
        onApiBaseUrlChange={(value) => updateConfig('apiBaseUrl', value)}
        onProjectIdChange={(value) => updateConfig('projectId', value)}
        onBearerTokenChange={(value) => updateConfig('bearerToken', value)}
        onSave={saveConfig}
        onLoad={loadConfig}
        configSaved={configSaved}
      />
      
      <FileSelector
        onFileSelect={onFileSelect}
        onUpload={handleUpload}
        onClear={handleClear}
        onCancel={handleCancelUpload}
        selectedFileCount={selectedFiles.length}
        uploading={uploading}
      />
      
      {uploading && overallProgress >= 0 && (
        <ProgressSection
          overallProgress={overallProgress}
          elapsedTime={elapsedTime}
          estimatedTimeRemaining={estimatedTimeRemaining}
          throughput={throughputDisplay}
          concurrency={concurrency}
        />
      )}
      
      <ImagePreviewGrid
        files={selectedFiles}
        fileProgress={fileProgress}
      />
    </div>
  );
};

export default ImageUploader;
