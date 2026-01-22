import * as apiService from '../services/api';

// Mock fetch globally
global.fetch = jest.fn();

describe('API Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createBlobs', () => {
    it('should call the correct endpoint', async () => {
      const mockResponse = [
        { blob_url: 'https://blob1', upload_url: 'https://upload1' },
        { blob_url: 'https://blob2', upload_url: 'https://upload2' }
      ];
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await apiService.createBlobs(
        'https://api.example.com',
        'project-123',
        'bearer-token',
        2
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/projects/project-123/storage/default/blobs',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Authorization': 'Bearer bearer-token',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ count_blobs: 2 })
        })
      );
      
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      });
      
      await expect(
        apiService.createBlobs('https://api.example.com', 'project-123', 'token', 1)
      ).rejects.toThrow('Failed to create blob URLs: 500 - Internal Server Error');
    });
  });

  describe('registerImage', () => {
    it('should register image with correct data', async () => {
      const mockResponse = { image_id: 'img-123' };
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await apiService.registerImage(
        'https://api.example.com',
        'project-123',
        'bearer-token',
        'test.jpg',
        'https://blob-url'
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/projects/project-123/images',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            filename: 'test.jpg',
            image_url: 'https://blob-url'
          })
        })
      );
      
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failure', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });
      
      await expect(
        apiService.registerImage('https://api.example.com', 'project-123', 'token', 'test.jpg', 'url')
      ).rejects.toThrow('Failed to register image: 401 - Unauthorized');
    });
  });

  describe('createSample', () => {
    it('should create sample with correct data', async () => {
      const mockResponse = [{ sample_id: 'sample-123' }];
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await apiService.createSample(
        'https://api.example.com',
        'project-123',
        'bearer-token',
        'my-sample',
        'img-123'
      );
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/projects/project-123/samples',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify([{
            name: 'my-sample',
            frames: {
              default: {
                image_id: 'img-123'
              }
            }
          }])
        })
      );
      
      expect(result.status).toBe(201);
      expect(result.data).toEqual(mockResponse);
    });

    it('should return 409 status on conflict', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () => Promise.resolve('Conflict')
      });
      
      const result = await apiService.createSample(
        'https://api.example.com',
        'project-123',
        'bearer-token',
        'existing-sample',
        'img-123'
      );
      
      expect(result.status).toBe(409);
      expect(result.data).toBeNull();
    });
  });

  describe('createSampleWithRetry', () => {
    it('should succeed on first try', async () => {
      const mockResponse = [{ sample_id: 'sample-123' }];
      
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockResponse)
      });
      
      const result = await apiService.createSampleWithRetry(
        'https://api.example.com',
        'project-123',
        'bearer-token',
        'my-sample',
        'img-123'
      );
      
      expect(result.sample_id).toBe('sample-123');
      expect(result.name).toBe('my-sample');
    });

    it('should retry on 409 conflict', async () => {
      // First call returns 409
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        text: () => Promise.resolve('Conflict')
      });
      
      // Second call succeeds
      global.fetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve([{ sample_id: 'sample-123' }])
      });
      
      const onRetry = jest.fn();
      
      const result = await apiService.createSampleWithRetry(
        'https://api.example.com',
        'project-123',
        'bearer-token',
        'my-sample',
        'img-123',
        10,
        onRetry
      );
      
      expect(onRetry).toHaveBeenCalledWith(1, 'my-sample_1');
      expect(result.name).toBe('my-sample_1');
    });

    it('should throw after max retries', async () => {
      // All calls return 409
      for (let i = 0; i <= 10; i++) {
        global.fetch.mockResolvedValueOnce({
          ok: false,
          status: 409,
          text: () => Promise.resolve('Conflict')
        });
      }
      
      await expect(
        apiService.createSampleWithRetry(
          'https://api.example.com',
          'project-123',
          'bearer-token',
          'my-sample',
          'img-123',
          10
        )
      ).rejects.toThrow('Failed to create sample after 10 retries');
    });
  });

  describe('uploadToBlob', () => {
    it('should upload file and track progress', async () => {
      // Create a mock file
      const mockFile = new File(['test content'], 'test.jpg', { type: 'image/jpeg' });
      
      // Mock XMLHttpRequest
      const mockXhr = {
        open: jest.fn(),
        send: jest.fn(),
        setRequestHeader: jest.fn(),
        upload: {
          addEventListener: jest.fn()
        },
        addEventListener: jest.fn(),
        status: 200
      };
      
      const originalXhr = global.XMLHttpRequest;
      global.XMLHttpRequest = jest.fn(() => mockXhr);
      
      const progressCallback = jest.fn();
      
      // Start the upload (don't await yet)
      const uploadPromise = apiService.uploadToBlob(
        'https://upload-url.com',
        mockFile,
        progressCallback
      );
      
      // Simulate load event
      const loadHandler = mockXhr.addEventListener.mock.calls.find(
        call => call[0] === 'load'
      )[1];
      loadHandler();
      
      const result = await uploadPromise;
      
      expect(mockXhr.open).toHaveBeenCalledWith('PUT', 'https://upload-url.com');
      expect(mockXhr.setRequestHeader).toHaveBeenCalledWith('x-ms-blob-type', 'BlockBlob');
      expect(mockXhr.send).toHaveBeenCalledWith(mockFile);
      expect(result.success).toBe(true);
      
      // Restore
      global.XMLHttpRequest = originalXhr;
    });
  });
});
