import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImageUploader from '../components/ImageUploader';
import { createMockApiService, createMockFiles } from '../__mocks__/apiService';

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(file => `blob:${file.name}`);
global.URL.revokeObjectURL = jest.fn();

// Mock IntersectionObserver for lazy loading
class MockIntersectionObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe(element) {
    // Immediately trigger as visible
    this.callback([{ isIntersecting: true, target: element }]);
  }
  unobserve() {}
  disconnect() {}
}
global.IntersectionObserver = MockIntersectionObserver;

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

describe('ImageUploader Integration Tests', () => {
  let mockApi;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
    mockApi = createMockApiService({
      createBlobsDelay: 10,
      uploadDelay: 50,
      registerImageDelay: 10,
      createSampleDelay: 10
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Rendering', () => {
    it('should render all configuration inputs', () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      expect(screen.getByLabelText(/API Base URL/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Project ID/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Bearer Token/i)).toBeInTheDocument();
    });

    it('should render file input and buttons', () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      expect(screen.getByTestId('file-input')).toBeInTheDocument();
      expect(screen.getByTestId('upload-button')).toBeInTheDocument();
      expect(screen.getByTestId('clear-button')).toBeInTheDocument();
    });

    it('should render save and load config buttons', () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      expect(screen.getByText(/Save Configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/Load Configuration/i)).toBeInTheDocument();
    });
  });

  describe('Configuration', () => {
    it('should update API base URL input', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const input = screen.getByLabelText(/API Base URL/i);
      await userEvent.clear(input);
      await userEvent.type(input, 'https://custom.api.com');
      
      expect(input.value).toBe('https://custom.api.com');
    });

    it('should update Project ID input', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const input = screen.getByLabelText(/Project ID/i);
      await userEvent.type(input, 'my-project-123');
      
      expect(input.value).toBe('my-project-123');
    });

    it('should save configuration to localStorage', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const projectInput = screen.getByLabelText(/Project ID/i);
      await userEvent.type(projectInput, 'test-project');
      
      const saveButton = screen.getByText(/Save Configuration/i);
      fireEvent.click(saveButton);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'imageUploaderConfig',
        expect.stringContaining('test-project')
      );
    });
  });

  describe('File Selection', () => {
    it('should display selected files', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const files = createMockFiles(2);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      expect(screen.getByText(/Selected Images \(2\)/i)).toBeInTheDocument();
    });

    it('should clear selected files', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      const clearButton = screen.getByTestId('clear-button');
      fireEvent.click(clearButton);
      
      expect(screen.queryByText(/Selected Images/i)).not.toBeInTheDocument();
    });

    it('should disable upload button when no files selected', () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const uploadButton = screen.getByTestId('upload-button');
      expect(uploadButton).toBeDisabled();
    });

    it('should enable upload button when files are selected', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      const uploadButton = screen.getByTestId('upload-button');
      expect(uploadButton).not.toBeDisabled();
    });
  });

  describe('Validation', () => {
    it('should show alert when uploading without bearer token', async () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      const uploadButton = screen.getByTestId('upload-button');
      fireEvent.click(uploadButton);
      
      expect(alertMock).toHaveBeenCalledWith('Please provide a bearer token');
      
      alertMock.mockRestore();
    });

    it('should show alert when uploading without project ID', async () => {
      const alertMock = jest.spyOn(window, 'alert').mockImplementation(() => {});
      
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      const tokenInput = screen.getByLabelText(/Bearer Token/i);
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      await userEvent.type(tokenInput, 'my-token');
      
      const uploadButton = screen.getByTestId('upload-button');
      fireEvent.click(uploadButton);
      
      expect(alertMock).toHaveBeenCalledWith('Please provide a project ID');
      
      alertMock.mockRestore();
    });
  });

  describe('Upload Flow', () => {
    it('should initiate upload with valid configuration', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      // Configure
      const projectInput = screen.getByLabelText(/Project ID/i);
      const tokenInput = screen.getByLabelText(/Bearer Token/i);
      
      await userEvent.type(projectInput, 'test-project');
      await userEvent.type(tokenInput, 'test-token');
      
      // Select files
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      // Upload
      const uploadButton = screen.getByTestId('upload-button');
      fireEvent.click(uploadButton);
      
      // Should show uploading state
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();
      });
    });

    it('should call createBlobs API', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      // Configure
      await userEvent.type(screen.getByLabelText(/Project ID/i), 'test-project');
      await userEvent.type(screen.getByLabelText(/Bearer Token/i), 'test-token');
      
      // Select files
      const files = createMockFiles(2);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      // Upload
      fireEvent.click(screen.getByTestId('upload-button'));
      
      await waitFor(() => {
        expect(mockApi.createBlobs).toHaveBeenCalledWith(
          expect.any(String),
          'test-project',
          'test-token',
          2
        );
      });
    });

    it('should display progress section during upload', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      // Configure
      await userEvent.type(screen.getByLabelText(/Project ID/i), 'test-project');
      await userEvent.type(screen.getByLabelText(/Bearer Token/i), 'test-token');
      
      // Select files
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      // Upload
      fireEvent.click(screen.getByTestId('upload-button'));
      
      await waitFor(() => {
        expect(screen.getByText(/Overall Progress/i)).toBeInTheDocument();
      });
    });

    it('should display upload in progress', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      // Configure
      await userEvent.type(screen.getByLabelText(/Project ID/i), 'test-project');
      await userEvent.type(screen.getByLabelText(/Bearer Token/i), 'test-token');
      
      // Select files
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      // Upload
      fireEvent.click(screen.getByTestId('upload-button'));
      
      // Should show uploading state
      await waitFor(() => {
        expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();
      });
    });

    it('should complete upload successfully', async () => {
      jest.useFakeTimers();
      
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      // Configure
      await userEvent.type(screen.getByLabelText(/Project ID/i), 'test-project');
      await userEvent.type(screen.getByLabelText(/Bearer Token/i), 'test-token');
      
      // Select files
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      // Upload
      await act(async () => {
        fireEvent.click(screen.getByTestId('upload-button'));
      });
      
      // Fast-forward timers
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      
      await waitFor(() => {
        expect(mockApi.createBlobs).toHaveBeenCalled();
      });
      
      jest.useRealTimers();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle blob creation failure', async () => {
      const failingApi = createMockApiService({
        createBlobsDelay: 10,
        failCreateBlobs: true
      });
      
      render(<ImageUploader apiServiceOverride={failingApi} />);
      
      // Configure
      await userEvent.type(screen.getByLabelText(/Project ID/i), 'test-project');
      await userEvent.type(screen.getByLabelText(/Bearer Token/i), 'test-token');
      
      // Select files
      const files = createMockFiles(1);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      // Upload - should not crash
      fireEvent.click(screen.getByTestId('upload-button'));
      
      // Wait a bit for the async operation to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The API should have been called
      expect(failingApi.createBlobs).toHaveBeenCalled();
    });
  });

  describe('Adaptive Concurrency', () => {
    it('should display concurrency info during upload', async () => {
      render(<ImageUploader apiServiceOverride={mockApi} />);
      
      // Configure
      await userEvent.type(screen.getByLabelText(/Project ID/i), 'test-project');
      await userEvent.type(screen.getByLabelText(/Bearer Token/i), 'test-token');
      
      // Select multiple files to trigger concurrency
      const files = createMockFiles(4);
      const fileInput = screen.getByTestId('file-input');
      
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });
      
      // Upload
      fireEvent.click(screen.getByTestId('upload-button'));
      
      await waitFor(() => {
        // Should show concurrent indicator
        expect(screen.getByText(/concurrent/i)).toBeInTheDocument();
      }, { timeout: 5000 });
    });
  });
});
