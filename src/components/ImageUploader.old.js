import React, { useState, useEffect } from 'react';
import './ImageUploader.css';

const ImageUploader = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [bearerToken, setBearerToken] = useState('');
  const [projectId, setProjectId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState([]);
  const [fileProgress, setFileProgress] = useState({});
  const [overallProgress, setOverallProgress] = useState(0);
  const [apiBaseUrl, setApiBaseUrl] = useState('https://www.cognex.com/api');
  const [configSaved, setConfigSaved] = useState(false);
  const [uploadStartTime, setUploadStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);

  // Auto-load saved configuration on component mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Track elapsed time during upload
  useEffect(() => {
    let interval;
    if (uploading && uploadStartTime) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - uploadStartTime) / 1000;
        setElapsedTime(elapsed);
        
        // Calculate estimated time remaining
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
  }, [uploading, uploadStartTime, overallProgress]);

  const saveConfig = () => {
    const config = {
      apiBaseUrl,
      projectId,
      bearerToken
    };
    localStorage.setItem('imageUploaderConfig', JSON.stringify(config));
    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const loadConfig = () => {
    const savedConfig = localStorage.getItem('imageUploaderConfig');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        if (config.apiBaseUrl) setApiBaseUrl(config.apiBaseUrl);
        if (config.projectId) setProjectId(config.projectId);
        if (config.bearerToken) setBearerToken(config.bearerToken);
      } catch (error) {
        console.error('Error loading saved configuration:', error);
      }
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);

    // Generate previews for selected images
    const previewUrls = files.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
    
    // Reset progress
    setFileProgress({});
    setOverallProgress(0);
    setUploadStatus([]);
    setElapsedTime(0);
    setEstimatedTimeRemaining(0);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one image to upload');
      return;
    }

    if (!bearerToken.trim()) {
      alert('Please provide a bearer token');
      return;
    }

    if (!projectId.trim()) {
      alert('Please provide a project ID');
      return;
    }

    setUploading(true);
    setUploadStatus([]);
    setFileProgress({});
    setOverallProgress(0);
    setUploadStartTime(Date.now());
    setElapsedTime(0);
    setEstimatedTimeRemaining(0);
    
    const statuses = [];
    const progressMap = {};

    try {
      // Step 1: Create blobs - call the create blob API
      const createBlobUrl = `${apiBaseUrl}/projects/${projectId}/storage/default/blobs`;
      
      statuses.push({ message: 'Creating blob URLs...', type: 'info' });
      setUploadStatus([...statuses]);
      
      const createBlobResponse = await fetch(createBlobUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          count_blobs: selectedFiles.length
        })
      });

      if (!createBlobResponse.ok) {
        const errorText = await createBlobResponse.text();
        throw new Error(`Failed to create blob URLs: ${createBlobResponse.status} - ${errorText}`);
      }

      const blobsData = await createBlobResponse.json();
      statuses.push({ message: `Created ${blobsData.length} blob URL(s)`, type: 'success' });
      setUploadStatus([...statuses]);

      // Initialize progress for each file
      selectedFiles.forEach((file, index) => {
        progressMap[index] = { progress: 0, status: 'pending', fileName: file.name };
      });
      setFileProgress({ ...progressMap });

      // Step 2: Upload files and immediately register them with progress tracking
      const uploadAndRegisterFile = async (file, index, blobInfo) => {
        return new Promise(async (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Track upload progress
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percentComplete = (e.loaded / e.total) * 100;
              progressMap[index] = {
                ...progressMap[index],
                progress: percentComplete,
                status: 'uploading'
              };
              setFileProgress({ ...progressMap });
              
              // Update overall progress
              const totalProgress = Object.values(progressMap).reduce((sum, item) => sum + item.progress, 0);
              const avgProgress = totalProgress / selectedFiles.length;
              setOverallProgress(avgProgress);
            }
          });
          
          // Handle completion
          xhr.addEventListener('load', async () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              progressMap[index] = {
                ...progressMap[index],
                progress: 100,
                status: 'completed'
              };
              setFileProgress({ ...progressMap });
              
              statuses.push({ message: `✓ ${file.name} uploaded to blob storage`, type: 'success' });
              setUploadStatus([...statuses]);
              
              try {
                // Immediately register the image
                statuses.push({ message: `Registering ${file.name}...`, type: 'info' });
                setUploadStatus([...statuses]);
                
                const addImageUrl = `${apiBaseUrl}/projects/${projectId}/images`;
                const addImageResponse = await fetch(addImageUrl, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${bearerToken}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    filename: file.name,
                    image_url: blobInfo.blob_url
                  })
                });
                
                if (!addImageResponse.ok) {
                  const errorText = await addImageResponse.text();
                  throw new Error(`Failed to register image: ${addImageResponse.status} - ${errorText}`);
                }
                
                const imageData = await addImageResponse.json();
                statuses.push({ message: `✓ Registered ${file.name}`, type: 'success' });
                setUploadStatus([...statuses]);
                
                // Immediately create the sample
                const sampleName = file.name.replace(/\.[^/.]+$/, '');
                let currentSampleName = sampleName;
                let retryCount = 0;
                let sampleCreated = false;
                
                while (!sampleCreated && retryCount < 10) {
                  try {
                    statuses.push({ message: `Creating sample: ${currentSampleName}...`, type: 'info' });
                    setUploadStatus([...statuses]);
                    
                    const addSamplesUrl = `${apiBaseUrl}/projects/${projectId}/samples`;
                    const addSamplesResponse = await fetch(addSamplesUrl, {
                      method: 'POST',
                      headers: {
                        'Authorization': `Bearer ${bearerToken}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify([{
                        name: currentSampleName,
                        frames: {
                          default: {
                            image_id: imageData.image_id
                          }
                        }
                      }])
                    });
                    
                    if (addSamplesResponse.status === 409) {
                      // Conflict - sample name already exists, retry with suffix
                      retryCount++;
                      currentSampleName = `${sampleName}_${retryCount}`;
                      statuses.push({ 
                        message: `⚠ Sample name conflict, retrying as: ${currentSampleName}`, 
                        type: 'info' 
                      });
                      setUploadStatus([...statuses]);
                      continue;
                    }
                    
                    if (!addSamplesResponse.ok) {
                      const errorText = await addSamplesResponse.text();
                      throw new Error(`Failed to create sample: ${addSamplesResponse.status} - ${errorText}`);
                    }
                    
                    const samplesData = await addSamplesResponse.json();
                    sampleCreated = true;
                    statuses.push({ 
                      message: `✓ Created sample: ${currentSampleName}`, 
                      type: 'success' 
                    });
                    setUploadStatus([...statuses]);
                    
                    resolve({
                      fileName: file.name,
                      blobUrl: blobInfo.blob_url,
                      imageId: imageData.image_id,
                      sampleId: samplesData[0].sample_id,
                      sampleName: currentSampleName
                    });
                  } catch (sampleError) {
                    if (retryCount >= 9) {
                      throw sampleError;
                    }
                    retryCount++;
                    currentSampleName = `${sampleName}_${retryCount}`;
                  }
                }
                
                if (!sampleCreated) {
                  throw new Error('Failed to create sample after 10 retries');
                }
                
              } catch (error) {
                statuses.push({ 
                  message: `✗ Failed to process ${file.name}: ${error.message}`, 
                  type: 'error' 
                });
                setUploadStatus([...statuses]);
                reject(error);
              }
            } else {
              progressMap[index] = {
                ...progressMap[index],
                status: 'error'
              };
              setFileProgress({ ...progressMap });
              reject(new Error(`Failed to upload ${file.name}: ${xhr.status}`));
            }
          });
          
          // Handle errors
          xhr.addEventListener('error', () => {
            progressMap[index] = {
              ...progressMap[index],
              status: 'error'
            };
            setFileProgress({ ...progressMap });
            reject(new Error(`Network error uploading ${file.name}`));
          });
          
          // Start upload
          xhr.open('PUT', blobInfo.upload_url);
          xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
          xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
          xhr.send(file);
        });
      };

      // Helper function to run promises with concurrency limit
      const runWithConcurrencyLimit = async (tasks, limit) => {
        const results = [];
        const executing = [];
        
        for (const [index, task] of tasks.entries()) {
          const promise = task().then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
          });
          
          results.push(promise);
          executing.push(promise);
          
          if (executing.length >= limit) {
            await Promise.race(executing);
          }
        }
        
        return Promise.all(results);
      };

      // Upload files with concurrency limit (4 simultaneous uploads for optimal performance)
      const UPLOAD_CONCURRENCY = 6;
      
      const uploadTasks = selectedFiles.map((file, index) => {
        return () => {
          const blobInfo = blobsData[index];
          
          if (!blobInfo || !blobInfo.upload_url) {
            return Promise.reject(new Error(`Missing upload URL for file ${index + 1}`));
          }

          statuses.push({ message: `Starting upload: ${file.name}`, type: 'info' });
          setUploadStatus([...statuses]);

          return uploadAndRegisterFile(file, index, blobInfo);
        };
      });

      const results = await runWithConcurrencyLimit(uploadTasks, UPLOAD_CONCURRENCY);
      
      setOverallProgress(100);
      statuses.push({ 
        message: `🎉 Complete! All ${selectedFiles.length} image(s) uploaded and added to project!`, 
        type: 'success' 
      });
      setUploadStatus([...statuses]);
      
      console.log('Upload results:', results);
      
      // Clear files after successful upload
      setTimeout(() => {
        setSelectedFiles([]);
        setPreviews([]);
        setFileProgress({});
        setOverallProgress(0);
      }, 3000);

    } catch (error) {
      console.error('Error uploading images:', error);
      statuses.push({ 
        message: `Error: ${error.message}`, 
        type: 'error' 
      });
      setUploadStatus([...statuses]);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setPreviews([]);
  };

  return (
    <div className="image-uploader">
      <h2>Image Uploader</h2>
      
      <div className="config-section">
        <div className="config-group">
          <label htmlFor="api-base-url">API Base URL:</label>
          <input
            id="api-base-url"
            type="text"
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://www.cognex.com/api"
            className="config-input"
          />
        </div>
        
        <div className="config-group">
          <label htmlFor="project-id">Project ID:</label>
          <input
            id="project-id"
            type="text"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            placeholder="Enter project UUID"
            className="config-input"
          />
        </div>
        
        <div className="config-group">
          <label htmlFor="bearer-token">Bearer Token:</label>
          <input
            id="bearer-token"
            type="password"
            value={bearerToken}
            onChange={(e) => setBearerToken(e.target.value)}
            placeholder="Enter your JWT token"
            className="config-input"
          />
        </div>
        
        <div className="config-buttons">
          <button 
            onClick={saveConfig}
            className="config-button save-button"
          >
            💾 Save Configuration
          </button>
          <button 
            onClick={loadConfig}
            className="config-button load-button"
          >
            📂 Load Configuration
          </button>
          {configSaved && (
            <span className="config-saved-message">✓ Configuration saved!</span>
          )}
        </div>
      </div>
      
      <div className="upload-section">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="file-input"
        />
        <div className="button-group">
          <button 
            onClick={handleUpload} 
            disabled={selectedFiles.length === 0 || uploading}
            className="upload-button"
          >
            {uploading ? 'Uploading...' : 'Upload Images'}
          </button>
          <button 
            onClick={handleClear} 
            disabled={selectedFiles.length === 0 || uploading}
            className="clear-button"
          >
            Clear
          </button>
        </div>
      </div>
      
      {uploading && overallProgress >= 0 && (
        <div className="progress-section">
          <div className="progress-header">
            <h3>Overall Progress</h3>
            <div className="time-info">
              <span className="time-elapsed">
                ⏱️ {elapsedTime.toFixed(1)}s
              </span>
              {estimatedTimeRemaining > 0 && overallProgress < 100 && (
                <span className="time-remaining">
                  ⏳ ~{estimatedTimeRemaining.toFixed(1)}s remaining
                </span>
              )}
            </div>
          </div>
          <div className="progress-bar-container">
            <div 
              className="progress-bar overall" 
              style={{ width: `${overallProgress}%` }}
            >
              <span className="progress-text">{Math.round(overallProgress)}%</span>
            </div>
          </div>
        </div>
      )}
      
      {uploadStatus.length > 0 && (
        <div className="status-section">
          <h3>Upload Status</h3>
          <div className="status-log">
            {uploadStatus.map((status, index) => (
              <div key={index} className={`status-message ${status.type}`}>
                {status.message}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {selectedFiles.length > 0 && (
        <div className="preview-section">
          <h3>Selected Images ({selectedFiles.length})</h3>
          <div className="preview-grid">
            {previews.map((preview, index) => {
              const progress = fileProgress[index];
              const isCompleted = progress && progress.status === 'completed';
              const isUploading = progress && progress.status === 'uploading';
              const hasError = progress && progress.status === 'error';
              const progressValue = progress ? progress.progress : 0;
              
              return (
                <div key={index} className={`preview-item ${isCompleted ? 'completed' : ''} ${hasError ? 'error' : ''}`}>
                  <div className="preview-image-wrapper">
                    <img src={preview} alt={`Preview ${index + 1}`} />
                    {isCompleted && (
                      <div className="upload-checkmark">
                        <svg width="48" height="48" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="22" fill="#4CAF50" />
                          <path 
                            d="M14 24 L20 30 L34 16" 
                            stroke="white" 
                            strokeWidth="3" 
                            fill="none" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                    {hasError && (
                      <div className="upload-error">
                        <svg width="48" height="48" viewBox="0 0 48 48">
                          <circle cx="24" cy="24" r="22" fill="#f44336" />
                          <path 
                            d="M16 16 L32 32 M32 16 L16 32" 
                            stroke="white" 
                            strokeWidth="3" 
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="preview-filename">{selectedFiles[index].name}</p>
                  {(isUploading || isCompleted || hasError) && (
                    <div className="preview-progress-container">
                      <div 
                        className={`preview-progress-bar ${progress.status}`}
                        style={{ width: `${progressValue}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
