import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';

/**
 * Single image preview with progress indicator
 * Uses lazy loading for the image
 */
const ImagePreviewItem = React.memo(({
  file,
  index,
  progress,
  status,
  isCompleted,
  isUploading,
  hasError
}) => {
  const itemRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [localPreview, setLocalPreview] = useState(null);
  const progressValue = progress || 0;

  // Intersection observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      {
        rootMargin: '100px', // Load slightly before visible
        threshold: 0.1
      }
    );

    if (itemRef.current) {
      observer.observe(itemRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Generate preview URL lazily when visible
  useEffect(() => {
    if (isVisible && !localPreview && file) {
      const url = URL.createObjectURL(file);
      setLocalPreview(url);
    }
  }, [isVisible, localPreview, file]);

  // Cleanup preview URL on unmount only (not on re-renders)
  // Store the URL in a ref to access it in cleanup without dependencies
  const previewUrlRef = useRef(null);
  
  useEffect(() => {
    previewUrlRef.current = localPreview;
  }, [localPreview]);
  
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  return (
    <div 
      ref={itemRef}
      className={`preview-item ${isCompleted ? 'completed' : ''} ${hasError ? 'error' : ''}`}
    >
      <div className="preview-image-wrapper">
        {isVisible && localPreview ? (
          <img 
            src={localPreview} 
            alt={`Preview of ${file?.name || 'image'}`}
            loading="lazy"
          />
        ) : (
          <div className="preview-placeholder">
            <span>📷</span>
          </div>
        )}
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
      <p className="preview-filename">{file?.name || `Image ${index + 1}`}</p>
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
});

ImagePreviewItem.displayName = 'ImagePreviewItem';

/**
 * Virtualized grid of image previews with infinite scrolling
 * Only renders visible items plus a buffer for performance
 */
const ImagePreviewGrid = ({ files, fileProgress }) => {
  const containerRef = useRef(null);
  const [displayCount, setDisplayCount] = useState(24);
  const ITEMS_PER_LOAD = 24; // Load 24 items at a time

  // Handle infinite scroll - load more when near bottom
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const scrolledToBottom = scrollTop + clientHeight >= scrollHeight - 200;
    
    if (scrolledToBottom && displayCount < files.length) {
      setDisplayCount(prev => Math.min(files.length, prev + ITEMS_PER_LOAD));
    }
  }, [displayCount, files.length]);

  // Attach scroll listener with debouncing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [handleScroll]);

  // Reset display count when files change
  useEffect(() => {
    setDisplayCount(Math.min(24, files.length));
  }, [files.length]);

  // Memoize visible items to prevent unnecessary re-renders
  const visibleItems = useMemo(() => {
    return files.slice(0, displayCount);
  }, [files, displayCount]);

  if (files.length === 0) {
    return null;
  }

  // Calculate statistics
  const completedCount = Object.values(fileProgress).filter(p => p?.status === 'completed').length;
  const errorCount = Object.values(fileProgress).filter(p => p?.status === 'error').length;
  const uploadingCount = Object.values(fileProgress).filter(p => p?.status === 'uploading').length;

  return (
    <div className="preview-section">
      <div className="preview-header">
        <h3>Selected Images ({files.length})</h3>
        <div className="preview-stats">
          {completedCount > 0 && (
            <span className="stat completed">✓ {completedCount}</span>
          )}
          {uploadingCount > 0 && (
            <span className="stat uploading">↑ {uploadingCount}</span>
          )}
          {errorCount > 0 && (
            <span className="stat error">✗ {errorCount}</span>
          )}
          {displayCount < files.length && (
            <span className="stat showing">
              Showing {displayCount} of {files.length}
            </span>
          )}
        </div>
      </div>
      <div 
        ref={containerRef}
        className="preview-grid-container"
      >
        <div className="preview-grid">
          {visibleItems.map((file, index) => {
            const progress = fileProgress[index];
            const isCompleted = progress && progress.status === 'completed';
            const isUploading = progress && progress.status === 'uploading';
            const hasError = progress && progress.status === 'error';
            
            return (
              <ImagePreviewItem
                key={`${file.name}-${index}`}
                file={file}
                index={index}
                progress={progress?.progress}
                status={progress?.status}
                isCompleted={isCompleted}
                isUploading={isUploading}
                hasError={hasError}
              />
            );
          })}
        </div>
        {displayCount < files.length && (
          <div className="load-more-indicator">
            <span>Scroll for more ({files.length - displayCount} remaining)</span>
          </div>
        )}
      </div>
    </div>
  );
};

export { ImagePreviewItem };
export default ImagePreviewGrid;
