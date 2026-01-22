import { renderHook, act, waitFor } from '@testing-library/react';
import { 
  useConfig, 
  useFileSelection, 
  useUploadProgress, 
  useUploadStatus 
} from '../hooks/useUpload';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => { store[key] = value; }),
    removeItem: jest.fn(key => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(file => `blob:${file.name}`);
global.URL.revokeObjectURL = jest.fn();

describe('useUpload Hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  describe('useConfig', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useConfig());
      
      expect(result.current.config.apiBaseUrl).toBe('https://www.cognex.com/api');
      expect(result.current.config.projectId).toBe('');
      expect(result.current.config.bearerToken).toBe('');
    });

    it('should update config values', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateConfig('projectId', 'test-project');
      });
      
      expect(result.current.config.projectId).toBe('test-project');
    });

    it('should save config to localStorage', () => {
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.updateConfig('projectId', 'test-project');
      });
      
      act(() => {
        result.current.saveConfig();
      });
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'imageUploaderConfig',
        expect.stringContaining('test-project')
      );
    });

    it('should load config from localStorage', () => {
      const savedConfig = JSON.stringify({
        apiBaseUrl: 'https://custom.api.com',
        projectId: 'saved-project',
        bearerToken: 'saved-token'
      });
      localStorageMock.getItem.mockReturnValue(savedConfig);
      
      const { result } = renderHook(() => useConfig());
      
      // Wait for useEffect to run
      expect(localStorageMock.getItem).toHaveBeenCalledWith('imageUploaderConfig');
    });

    it('should set configSaved flag temporarily', async () => {
      jest.useFakeTimers();
      const { result } = renderHook(() => useConfig());
      
      act(() => {
        result.current.saveConfig();
      });
      
      expect(result.current.configSaved).toBe(true);
      
      act(() => {
        jest.advanceTimersByTime(2000);
      });
      
      expect(result.current.configSaved).toBe(false);
      
      jest.useRealTimers();
    });
  });

  describe('useFileSelection', () => {
    it('should initialize with empty array', () => {
      const { result } = renderHook(() => useFileSelection());
      
      expect(result.current.selectedFiles).toEqual([]);
    });

    it('should handle file selection', () => {
      const { result } = renderHook(() => useFileSelection());
      
      const mockFiles = [
        new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'file2.jpg', { type: 'image/jpeg' })
      ];
      
      act(() => {
        result.current.handleFileSelect(mockFiles);
      });
      
      expect(result.current.selectedFiles).toHaveLength(2);
    });

    it('should clear files', () => {
      const { result } = renderHook(() => useFileSelection());
      
      const mockFiles = [
        new File(['content'], 'file.jpg', { type: 'image/jpeg' })
      ];
      
      act(() => {
        result.current.handleFileSelect(mockFiles);
      });
      
      act(() => {
        result.current.clearFiles();
      });
      
      expect(result.current.selectedFiles).toEqual([]);
    });
  });

  describe('useUploadProgress', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useUploadProgress(0));
      
      expect(result.current.fileProgress).toEqual({});
      expect(result.current.overallProgress).toBe(0);
      expect(result.current.elapsedTime).toBe(0);
      expect(result.current.currentThroughput).toBe(0);
    });

    it('should start tracking', () => {
      const { result } = renderHook(() => useUploadProgress(3));
      
      act(() => {
        result.current.startTracking();
      });
      
      expect(result.current.uploadStartTime).not.toBeNull();
      expect(result.current.overallProgress).toBe(0);
    });

    it('should update file progress', () => {
      const { result } = renderHook(() => useUploadProgress(3));
      
      act(() => {
        result.current.updateFileProgress(0, 50, 'uploading');
      });
      
      expect(result.current.fileProgress[0]).toEqual({
        progress: 50,
        status: 'uploading'
      });
    });

    it('should reset progress', () => {
      const { result } = renderHook(() => useUploadProgress(3));
      
      act(() => {
        result.current.startTracking();
        result.current.updateFileProgress(0, 100, 'completed');
      });
      
      act(() => {
        result.current.resetProgress();
      });
      
      expect(result.current.fileProgress).toEqual({});
      expect(result.current.overallProgress).toBe(0);
      expect(result.current.uploadStartTime).toBeNull();
    });
  });

  describe('useUploadStatus', () => {
    it('should initialize with empty array', () => {
      const { result } = renderHook(() => useUploadStatus());
      
      expect(result.current.statuses).toEqual([]);
    });

    it('should add status message', () => {
      const { result } = renderHook(() => useUploadStatus());
      
      act(() => {
        result.current.addStatus('Uploading...', 'info');
      });
      
      expect(result.current.statuses).toHaveLength(1);
      expect(result.current.statuses[0]).toEqual({
        message: 'Uploading...',
        type: 'info'
      });
    });

    it('should add multiple status messages', () => {
      const { result } = renderHook(() => useUploadStatus());
      
      act(() => {
        result.current.addStatus('Step 1', 'info');
        result.current.addStatus('Step 2', 'success');
        result.current.addStatus('Error', 'error');
      });
      
      expect(result.current.statuses).toHaveLength(3);
    });

    it('should clear statuses', () => {
      const { result } = renderHook(() => useUploadStatus());
      
      act(() => {
        result.current.addStatus('Message', 'info');
      });
      
      act(() => {
        result.current.clearStatuses();
      });
      
      expect(result.current.statuses).toEqual([]);
    });
  });
});
