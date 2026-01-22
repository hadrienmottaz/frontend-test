import React from 'react';

/**
 * File selection input and action buttons
 */
const FileSelector = ({
  onFileSelect,
  onUpload,
  onClear,
  selectedFileCount,
  uploading
}) => {
  const handleChange = (event) => {
    onFileSelect(event.target.files);
  };

  return (
    <div className="upload-section">
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        className="file-input"
        data-testid="file-input"
      />
      <div className="button-group">
        <button 
          onClick={onUpload} 
          disabled={selectedFileCount === 0 || uploading}
          className="upload-button"
          data-testid="upload-button"
        >
          {uploading ? 'Uploading...' : 'Upload Images'}
        </button>
        <button 
          onClick={onClear} 
          disabled={selectedFileCount === 0 || uploading}
          className="clear-button"
          data-testid="clear-button"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default FileSelector;
