import React from 'react';

/**
 * Single image preview with progress indicator
 */
const ImagePreviewItem = ({
  preview,
  fileName,
  progress,
  status,
  isCompleted,
  isUploading,
  hasError
}) => {
  const progressValue = progress || 0;

  return (
    <div className={`preview-item ${isCompleted ? 'completed' : ''} ${hasError ? 'error' : ''}`}>
      <div className="preview-image-wrapper">
        <img src={preview} alt={`Preview of ${fileName}`} />
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
      <p className="preview-filename">{fileName}</p>
      {(isUploading || isCompleted || hasError) && (
        <div className="preview-progress-container">
          <div 
            className={`preview-progress-bar ${status}`}
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Grid of image previews
 */
const ImagePreviewGrid = ({ files, previews, fileProgress }) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="preview-section">
      <h3>Selected Images ({files.length})</h3>
      <div className="preview-grid">
        {previews.map((preview, index) => {
          const progress = fileProgress[index];
          const isCompleted = progress && progress.status === 'completed';
          const isUploading = progress && progress.status === 'uploading';
          const hasError = progress && progress.status === 'error';
          
          return (
            <ImagePreviewItem
              key={index}
              preview={preview}
              fileName={files[index].name}
              progress={progress?.progress}
              status={progress?.status}
              isCompleted={isCompleted}
              isUploading={isUploading}
              hasError={hasError}
            />
          );
        })}
      </div>
    </div>
  );
};

export { ImagePreviewItem };
export default ImagePreviewGrid;
