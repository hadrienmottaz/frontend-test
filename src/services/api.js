/**
 * API Service Module
 * Handles all API calls for image upload functionality
 */

/**
 * Creates blob URLs for uploading images
 * @param {string} baseUrl - API base URL
 * @param {string} projectId - Project UUID
 * @param {string} bearerToken - JWT authentication token
 * @param {number} count - Number of blob URLs to create
 * @returns {Promise<Array<{blob_url: string, upload_url: string}>>}
 */
export const createBlobs = async (baseUrl, projectId, bearerToken, count) => {
  const url = `${baseUrl}/projects/${projectId}/storage/default/blobs`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      count_blobs: count
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create blob URLs: ${response.status} - ${errorText}`);
  }

  return response.json();
};

/**
 * Uploads a file to Azure blob storage using XHR for progress tracking
 * @param {string} uploadUrl - The Azure blob upload URL
 * @param {File} file - The file to upload
 * @param {function} onProgress - Progress callback (bytesLoaded, totalBytes)
 * @returns {Promise<{success: boolean, bytesUploaded: number, duration: number}>}
 */
export const uploadToBlob = (uploadUrl, file, onProgress) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(e.loaded, e.total);
      }
    });
    
    xhr.addEventListener('load', () => {
      const duration = Date.now() - startTime;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          success: true,
          bytesUploaded: file.size,
          duration
        });
      } else {
        reject(new Error(`Failed to upload: ${xhr.status}`));
      }
    });
    
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });
    
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });
};

/**
 * Registers an image with the project
 * @param {string} baseUrl - API base URL
 * @param {string} projectId - Project UUID
 * @param {string} bearerToken - JWT authentication token
 * @param {string} filename - Original filename
 * @param {string} blobUrl - URL where the image was uploaded
 * @returns {Promise<{image_id: string}>}
 */
export const registerImage = async (baseUrl, projectId, bearerToken, filename, blobUrl) => {
  const url = `${baseUrl}/projects/${projectId}/images`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename,
      image_url: blobUrl
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to register image: ${response.status} - ${errorText}`);
  }

  return response.json();
};

/**
 * Creates a sample from an image
 * @param {string} baseUrl - API base URL
 * @param {string} projectId - Project UUID
 * @param {string} bearerToken - JWT authentication token
 * @param {string} sampleName - Name for the sample
 * @param {string} imageId - Image ID to associate with sample
 * @returns {Promise<{sample_id: string, status: number}>}
 */
export const createSample = async (baseUrl, projectId, bearerToken, sampleName, imageId) => {
  const url = `${baseUrl}/projects/${projectId}/samples`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([{
      name: sampleName,
      frames: {
        default: {
          image_id: imageId
        }
      }
    }])
  });

  return {
    status: response.status,
    data: response.ok ? await response.json() : null,
    error: !response.ok ? await response.text() : null
  };
};

/**
 * Creates a sample with automatic retry on name conflicts
 * @param {string} baseUrl - API base URL
 * @param {string} projectId - Project UUID
 * @param {string} bearerToken - JWT authentication token
 * @param {string} baseName - Base name for the sample
 * @param {string} imageId - Image ID to associate with sample
 * @param {number} maxRetries - Maximum number of retries on conflict
 * @param {function} onRetry - Callback when retry happens (attemptNumber, newName)
 * @returns {Promise<{sample_id: string, name: string}>}
 */
export const createSampleWithRetry = async (
  baseUrl, 
  projectId, 
  bearerToken, 
  baseName, 
  imageId,
  maxRetries = 10,
  onRetry = null
) => {
  let currentName = baseName;
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    const result = await createSample(baseUrl, projectId, bearerToken, currentName, imageId);
    
    if (result.status === 409) {
      // Conflict - sample name exists
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
};

// Export all functions as a service object for easier mocking
const apiService = {
  createBlobs,
  uploadToBlob,
  registerImage,
  createSample,
  createSampleWithRetry
};

export default apiService;
