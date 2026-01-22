/**
 * Mock API Service for Testing
 * Provides configurable mock implementations of all API functions
 */

/**
 * Creates a mock API service with configurable behavior
 * @param {Object} options - Configuration options
 * @returns {Object} Mock API service
 */
export const createMockApiService = (options = {}) => {
  const {
    createBlobsDelay = 100,
    uploadDelay = 500,
    registerImageDelay = 100,
    createSampleDelay = 100,
    failCreateBlobs = false,
    failUpload = false,
    failRegisterImage = false,
    failCreateSample = false,
    sampleConflictCount = 0, // Number of 409 conflicts before success
    uploadProgressSteps = 5
  } = options;

  // Track calls for assertions
  const calls = {
    createBlobs: [],
    uploadToBlob: [],
    registerImage: [],
    createSample: [],
    createSampleWithRetry: []
  };

  // Reset call tracking
  const resetCalls = () => {
    Object.keys(calls).forEach(key => {
      calls[key] = [];
    });
  };

  // Mock createBlobs
  const createBlobs = jest.fn(async (baseUrl, projectId, bearerToken, count) => {
    calls.createBlobs.push({ baseUrl, projectId, bearerToken, count });
    
    await new Promise(resolve => setTimeout(resolve, createBlobsDelay));
    
    if (failCreateBlobs) {
      throw new Error('Failed to create blob URLs: 500 - Internal Server Error');
    }
    
    return Array.from({ length: count }, (_, i) => ({
      blob_url: `https://storage.azure.com/container/blob-${i}`,
      upload_url: `https://storage.azure.com/container/blob-${i}?sas=token`
    }));
  });

  // Mock uploadToBlob
  const uploadToBlob = jest.fn((uploadUrl, file, onProgress) => {
    calls.uploadToBlob.push({ uploadUrl, fileName: file.name, fileSize: file.size });
    
    return new Promise((resolve, reject) => {
      if (failUpload) {
        setTimeout(() => reject(new Error('Failed to upload: 500')), uploadDelay);
        return;
      }

      // Simulate progress updates
      let progress = 0;
      const stepDelay = uploadDelay / uploadProgressSteps;
      const stepSize = file.size / uploadProgressSteps;

      const progressInterval = setInterval(() => {
        progress += stepSize;
        if (progress >= file.size) {
          progress = file.size;
          clearInterval(progressInterval);
          
          setTimeout(() => {
            resolve({
              success: true,
              bytesUploaded: file.size,
              duration: uploadDelay
            });
          }, stepDelay);
        }
        
        if (onProgress) {
          onProgress(progress, file.size);
        }
      }, stepDelay);
    });
  });

  // Mock registerImage
  const registerImage = jest.fn(async (baseUrl, projectId, bearerToken, filename, blobUrl) => {
    calls.registerImage.push({ baseUrl, projectId, bearerToken, filename, blobUrl });
    
    await new Promise(resolve => setTimeout(resolve, registerImageDelay));
    
    if (failRegisterImage) {
      throw new Error('Failed to register image: 500 - Internal Server Error');
    }
    
    return {
      image_id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  });

  // Track conflict count per sample name
  const sampleConflicts = {};

  // Mock createSample
  const createSample = jest.fn(async (baseUrl, projectId, bearerToken, sampleName, imageId) => {
    calls.createSample.push({ baseUrl, projectId, bearerToken, sampleName, imageId });
    
    await new Promise(resolve => setTimeout(resolve, createSampleDelay));
    
    if (failCreateSample) {
      return {
        status: 500,
        data: null,
        error: 'Internal Server Error'
      };
    }

    // Handle conflict simulation
    const baseName = sampleName.replace(/_\d+$/, '');
    if (!sampleConflicts[baseName]) {
      sampleConflicts[baseName] = 0;
    }
    
    if (sampleConflicts[baseName] < sampleConflictCount) {
      sampleConflicts[baseName]++;
      return {
        status: 409,
        data: null,
        error: 'Conflict - sample name already exists'
      };
    }
    
    return {
      status: 201,
      data: [{
        sample_id: `sample-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: sampleName
      }],
      error: null
    };
  });

  // Mock createSampleWithRetry
  const createSampleWithRetry = jest.fn(async (
    baseUrl, 
    projectId, 
    bearerToken, 
    baseName, 
    imageId,
    maxRetries = 10,
    onRetry = null
  ) => {
    calls.createSampleWithRetry.push({ 
      baseUrl, projectId, bearerToken, baseName, imageId, maxRetries 
    });

    let currentName = baseName;
    let retryCount = 0;

    while (retryCount <= maxRetries) {
      const result = await createSample(baseUrl, projectId, bearerToken, currentName, imageId);
      
      if (result.status === 409) {
        retryCount++;
        if (retryCount > maxRetries) {
          throw new Error(`Failed to create sample after ${maxRetries} retries`);
        }
        currentName = `${baseName}_${retryCount}`;
        if (onRetry) {
          onRetry(retryCount, currentName);
        }
        continue;
      }

      if (result.status >= 200 && result.status < 300) {
        return {
          sample_id: result.data[0].sample_id,
          name: currentName
        };
      }

      throw new Error(`Failed to create sample: ${result.status} - ${result.error}`);
    }

    throw new Error('Failed to create sample after max retries');
  });

  return {
    createBlobs,
    uploadToBlob,
    registerImage,
    createSample,
    createSampleWithRetry,
    // Testing utilities
    calls,
    resetCalls,
    // Allow reconfiguring mock behavior
    setFailure: (type, shouldFail) => {
      switch (type) {
        case 'createBlobs':
          options.failCreateBlobs = shouldFail;
          break;
        case 'upload':
          options.failUpload = shouldFail;
          break;
        case 'registerImage':
          options.failRegisterImage = shouldFail;
          break;
        case 'createSample':
          options.failCreateSample = shouldFail;
          break;
        default:
          break;
      }
    }
  };
};

/**
 * Creates a mock file for testing
 * @param {string} name - File name
 * @param {number} size - File size in bytes
 * @param {string} type - MIME type
 * @returns {File} Mock file object
 */
export const createMockFile = (name = 'test.jpg', size = 1024 * 1024, type = 'image/jpeg') => {
  const content = new Array(size).fill('a').join('');
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

/**
 * Creates multiple mock files
 * @param {number} count - Number of files to create
 * @param {number} sizeEach - Size of each file in bytes
 * @returns {File[]} Array of mock files
 */
export const createMockFiles = (count, sizeEach = 1024 * 1024) => {
  return Array.from({ length: count }, (_, i) => 
    createMockFile(`test-image-${i + 1}.jpg`, sizeEach)
  );
};

/**
 * Default mock API service instance
 */
export const mockApiService = createMockApiService();

export default mockApiService;
