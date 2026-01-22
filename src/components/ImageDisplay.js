import React, { useState, useRef, useEffect } from 'react';
import './ImageDisplay.css';

const ImageDisplay = () => {
  const [imageUrl, setImageUrl] = useState(null);
  const [numRectangles, setNumRectangles] = useState(0);
  const [rectangles, setRectangles] = useState([]);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Clean up object URL on component unmount or when new image is loaded
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [imageUrl]);

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Revoke old object URL before creating a new one
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
      
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setRectangles([]); // Clear existing rectangles when new image is loaded
    }
  };

  const generateRandomRectangles = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const newRectangles = [];
    for (let i = 0; i < numRectangles; i++) {
      // Generate random dimensions (between 10% and 30% of image dimensions)
      const width = Math.random() * (imgWidth * 0.2) + imgWidth * 0.1;
      const height = Math.random() * (imgHeight * 0.2) + imgHeight * 0.1;
      
      // Generate random position ensuring rectangle fits within image
      const x = Math.random() * (imgWidth - width);
      const y = Math.random() * (imgHeight - height);
      
      // Generate random color
      const color = `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, 0.5)`;
      
      newRectangles.push({ x, y, width, height, color });
    }
    
    setRectangles(newRectangles);
  };

  const drawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;

    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');

    if (!img.complete) {
      // Use a ref-based approach to avoid stale closures
      const handleLoad = () => {
        if (canvasRef.current && imageRef.current) {
          drawCanvas();
        }
      };
      img.onload = handleLoad;
      return;
    }

    // Set canvas size to match image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw rectangles
    rectangles.forEach(rect => {
      ctx.fillStyle = rect.color;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    });
  }, [rectangles]);

  useEffect(() => {
    if (imageUrl && imageRef.current && canvasRef.current) {
      drawCanvas();
    }
  }, [imageUrl, rectangles, drawCanvas]);

  const handleNumRectanglesChange = (event) => {
    const value = parseInt(event.target.value, 10);
    setNumRectangles(isNaN(value) ? 0 : value);
  };

  const clearRectangles = () => {
    setRectangles([]);
  };

  return (
    <div className="image-display">
      <h2>Image Display with Rectangle Overlay</h2>
      
      <div className="controls">
        <div className="control-group">
          <label htmlFor="image-input">Select Image:</label>
          <input
            id="image-input"
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="file-input"
          />
        </div>

        {imageUrl && (
          <>
            <div className="control-group">
              <label htmlFor="num-rectangles">Number of Rectangles:</label>
              <input
                id="num-rectangles"
                type="number"
                min="0"
                max="50"
                value={numRectangles}
                onChange={handleNumRectanglesChange}
                className="number-input"
              />
            </div>

            <div className="button-group">
              <button 
                onClick={generateRandomRectangles}
                className="generate-button"
              >
                Generate Rectangles
              </button>
              <button 
                onClick={clearRectangles}
                className="clear-button"
                disabled={rectangles.length === 0}
              >
                Clear Rectangles
              </button>
            </div>
          </>
        )}
      </div>

      {imageUrl && (
        <div className="display-section">
          <div className="canvas-container">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Selected"
              style={{ display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="image-canvas"
            />
          </div>
          <p className="info-text">
            {rectangles.length > 0 
              ? `Displaying ${rectangles.length} rectangle(s)`
              : 'No rectangles overlaid'}
          </p>
        </div>
      )}

      {!imageUrl && (
        <div className="placeholder">
          <p>Please select an image to display</p>
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;
