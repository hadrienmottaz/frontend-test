import React, { useState, useRef, useEffect } from 'react';
import './ImageDisplay.css';

const ImageDisplay = () => {
  const [imageUrl, setImageUrl] = useState(null);
  const [numCrosses, setNumCrosses] = useState(0);
  const [crosses, setCrosses] = useState([]);
  const [rectangles, setRectangles] = useState([]);
  const [selectedRect, setSelectedRect] = useState(null);
  const [interactionMode, setInteractionMode] = useState(null); // null, 'move', 'resize', 'rotate', 'create'
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);
  
  const CROSS_SIZE_PX = 20; // Fixed size in pixels

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageUrl(url);
      setCrosses([]);
      setRectangles([]);
      setSelectedRect(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  };

  const generateRandomCrosses = () => {
    if (!imageRef.current) return;

    const img = imageRef.current;
    
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const newCrosses = [];
    for (let i = 0; i < numCrosses; i++) {
      // Generate random position
      const x = Math.random() * imgWidth;
      const y = Math.random() * imgHeight;
      
      // Generate random color
      const color = `rgb(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)})`;
      
      newCrosses.push({ x, y, color });
    }
    
    setCrosses(newCrosses);
  };

  const drawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!img.complete) {
      img.onload = () => drawCanvas();
      return;
    }

    // Set canvas size to match image
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(img, 0, 0);

    // Draw crosses (zoom-independent with fixed pixel size)
    crosses.forEach(cross => {
      const adjustedSize = CROSS_SIZE_PX / zoom;
      const adjustedLineWidth = 2 / zoom;
      
      ctx.strokeStyle = cross.color;
      ctx.lineWidth = adjustedLineWidth;
      ctx.lineCap = 'round';
      
      // Draw horizontal line
      ctx.beginPath();
      ctx.moveTo(cross.x - adjustedSize / 2, cross.y);
      ctx.lineTo(cross.x + adjustedSize / 2, cross.y);
      ctx.stroke();
      
      // Draw vertical line
      ctx.beginPath();
      ctx.moveTo(cross.x, cross.y - adjustedSize / 2);
      ctx.lineTo(cross.x, cross.y + adjustedSize / 2);
      ctx.stroke();
    });
    
    // Draw rectangles
    rectangles.forEach((rect, index) => {
      ctx.save();
      ctx.translate(rect.x, rect.y);
      ctx.rotate(rect.rotation);
      
      // Draw rectangle
      ctx.strokeStyle = index === selectedRect ? '#00ff00' : '#ff0000';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(-rect.width / 2, -rect.height / 2, rect.width, rect.height);
      
      // Draw resize handles if selected
      if (index === selectedRect) {
        const handleSize = 8 / zoom;
        ctx.fillStyle = '#00ff00';
        // Corner handles
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([dx, dy]) => {
          ctx.fillRect(
            (dx * rect.width / 2) - handleSize / 2,
            (dy * rect.height / 2) - handleSize / 2,
            handleSize,
            handleSize
          );
        });
        // Rotation handle
        ctx.fillStyle = '#0000ff';
        ctx.beginPath();
        ctx.arc(0, -rect.height / 2 - 20 / zoom, handleSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    });
  }, [crosses, rectangles, selectedRect, zoom, CROSS_SIZE_PX]);

  useEffect(() => {
    if (imageUrl && imageRef.current && canvasRef.current) {
      drawCanvas();
    }
  }, [imageUrl, crosses, rectangles, selectedRect, zoom, drawCanvas]);

  const handleNumCrossesChange = (event) => {
    const value = parseInt(event.target.value, 10);
    setNumCrosses(isNaN(value) ? 0 : value);
  };

  const clearCrosses = () => {
    setCrosses([]);
  };

  const handleWheel = (event) => {
    event.preventDefault();
    
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Get the current point under the mouse in the image space
    const pointX = (mouseX - pan.x) / zoom;
    const pointY = (mouseY - pan.y) / zoom;
    
    const zoomSpeed = 0.1;
    const delta = event.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    
    setZoom(prevZoom => {
      const newZoom = prevZoom + delta;
      // Limit zoom between 0.1x and 5x
      const clampedZoom = Math.min(Math.max(newZoom, 0.1), 5);
      
      // Calculate new pan to keep the same point under the mouse
      const newPanX = mouseX - pointX * clampedZoom;
      const newPanY = mouseY - pointY * clampedZoom;
      
      setPan({ x: newPanX, y: newPanY });
      
      return clampedZoom;
    });
  };

  const handleMouseDown = (event) => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    
    const rect = container.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    
    // Convert to canvas coordinates
    const canvasX = (clientX - pan.x) / zoom;
    const canvasY = (clientY - pan.y) / zoom;
    
    // Check if clicking on a rectangle or handle
    let clickedOnRect = false;
    for (let i = rectangles.length - 1; i >= 0; i--) {
      const r = rectangles[i];
      const handle = getHandleAtPoint(r, canvasX, canvasY, i === selectedRect);
      
      if (handle) {
        setSelectedRect(i);
        setResizeHandle(handle);
        setInteractionMode(handle.type);
        setDragStart({ x: canvasX, y: canvasY, rectState: { ...r } });
        clickedOnRect = true;
        event.preventDefault();
        break;
      } else if (isPointInRect(r, canvasX, canvasY)) {
        setSelectedRect(i);
        setInteractionMode('move');
        setDragStart({ x: canvasX, y: canvasY, rectState: { ...r } });
        clickedOnRect = true;
        event.preventDefault();
        break;
      }
    }
    
    if (!clickedOnRect) {
      if (event.ctrlKey || event.metaKey) {
        // Start creating new rectangle
        setInteractionMode('create');
        setDragStart({ x: canvasX, y: canvasY });
        event.preventDefault();
      } else {
        // Start panning
        setSelectedRect(null);
        setIsPanning(true);
        setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
        event.preventDefault();
      }
    }
  };

  const handleMouseMove = (event) => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    
    const rect = container.getBoundingClientRect();
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    const canvasX = (clientX - pan.x) / zoom;
    const canvasY = (clientY - pan.y) / zoom;
    
    if (isPanning) {
      const newPanX = event.clientX - dragStart.x;
      const newPanY = event.clientY - dragStart.y;
      setPan({ x: newPanX, y: newPanY });
    } else if (interactionMode === 'create') {
      // Show preview of rectangle being created
      const width = Math.abs(canvasX - dragStart.x);
      const height = Math.abs(canvasY - dragStart.y);
      const x = (canvasX + dragStart.x) / 2;
      const y = (canvasY + dragStart.y) / 2;
      // Draw temporary rectangle (will be added on mouse up)
    } else if (interactionMode === 'move' && selectedRect !== null) {
      const dx = canvasX - dragStart.x;
      const dy = canvasY - dragStart.y;
      const newRects = [...rectangles];
      newRects[selectedRect] = {
        ...dragStart.rectState,
        x: dragStart.rectState.x + dx,
        y: dragStart.rectState.y + dy
      };
      setRectangles(newRects);
    } else if (interactionMode === 'resize' && selectedRect !== null && resizeHandle) {
      const r = dragStart.rectState;
      const dx = canvasX - dragStart.x;
      const dy = canvasY - dragStart.y;
      
      // Rotate deltas back to rectangle's local coordinates
      const cos = Math.cos(-r.rotation);
      const sin = Math.sin(-r.rotation);
      const localDx = dx * cos - dy * sin;
      const localDy = dx * sin + dy * cos;
      
      const newRects = [...rectangles];
      const handle = resizeHandle;
      let newWidth = r.width;
      let newHeight = r.height;
      let newX = r.x;
      let newY = r.y;
      
      if (handle.corner === 'se') {
        newWidth = Math.max(20, r.width + localDx * 2);
        newHeight = Math.max(20, r.height + localDy * 2);
      } else if (handle.corner === 'sw') {
        newWidth = Math.max(20, r.width - localDx * 2);
        newHeight = Math.max(20, r.height + localDy * 2);
      } else if (handle.corner === 'ne') {
        newWidth = Math.max(20, r.width + localDx * 2);
        newHeight = Math.max(20, r.height - localDy * 2);
      } else if (handle.corner === 'nw') {
        newWidth = Math.max(20, r.width - localDx * 2);
        newHeight = Math.max(20, r.height - localDy * 2);
      }
      
      newRects[selectedRect] = {
        ...r,
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY
      };
      setRectangles(newRects);
    } else if (interactionMode === 'rotate' && selectedRect !== null) {
      const r = dragStart.rectState;
      const angle1 = Math.atan2(dragStart.y - r.y, dragStart.x - r.x);
      const angle2 = Math.atan2(canvasY - r.y, canvasX - r.x);
      const newRotation = r.rotation + (angle2 - angle1);
      
      const newRects = [...rectangles];
      newRects[selectedRect] = {
        ...r,
        rotation: newRotation
      };
      setRectangles(newRects);
    }
  };

  const handleMouseUp = (event) => {
    if (interactionMode === 'create') {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (container && canvas) {
        const rect = container.getBoundingClientRect();
        const clientX = event.clientX - rect.left;
        const clientY = event.clientY - rect.top;
        const canvasX = (clientX - pan.x) / zoom;
        const canvasY = (clientY - pan.y) / zoom;
        
        const width = Math.abs(canvasX - dragStart.x);
        const height = Math.abs(canvasY - dragStart.y);
        
        if (width > 10 && height > 10) {
          const newRect = {
            x: (canvasX + dragStart.x) / 2,
            y: (canvasY + dragStart.y) / 2,
            width,
            height,
            rotation: 0
          };
          setRectangles([...rectangles, newRect]);
          setSelectedRect(rectangles.length);
        }
      }
    }
    
    setIsPanning(false);
    setInteractionMode(null);
    setResizeHandle(null);
  };
  
  const getHandleAtPoint = (rect, x, y, isSelected) => {
    if (!isSelected) return null;
    
    const handleSize = 8 / zoom;
    
    // Transform point to rectangle's local coordinates
    const dx = x - rect.x;
    const dy = y - rect.y;
    const cos = Math.cos(-rect.rotation);
    const sin = Math.sin(-rect.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    
    // Check rotation handle
    const rotHandleX = 0;
    const rotHandleY = -rect.height / 2 - 20 / zoom;
    if (Math.abs(localX - rotHandleX) < handleSize && Math.abs(localY - rotHandleY) < handleSize) {
      return { type: 'rotate' };
    }
    
    // Check corner handles
    const corners = [
      { x: -rect.width / 2, y: -rect.height / 2, corner: 'nw' },
      { x: rect.width / 2, y: -rect.height / 2, corner: 'ne' },
      { x: rect.width / 2, y: rect.height / 2, corner: 'se' },
      { x: -rect.width / 2, y: rect.height / 2, corner: 'sw' }
    ];
    
    for (const corner of corners) {
      if (Math.abs(localX - corner.x) < handleSize && Math.abs(localY - corner.y) < handleSize) {
        return { type: 'resize', corner: corner.corner };
      }
    }
    
    return null;
  };
  
  const isPointInRect = (rect, x, y) => {
    const dx = x - rect.x;
    const dy = y - rect.y;
    const cos = Math.cos(-rect.rotation);
    const sin = Math.sin(-rect.rotation);
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    
    return Math.abs(localX) <= rect.width / 2 && Math.abs(localY) <= rect.height / 2;
  };

  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="image-display">
      <h2>Image Display with Cross Overlay</h2>
      
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
              <label htmlFor="num-crosses">Number of Crosses:</label>
              <input
                id="num-crosses"
                type="number"
                min="0"
                max="50"
                value={numCrosses}
                onChange={handleNumCrossesChange}
                className="number-input"
              />
            </div>

            <div className="button-group">
              <button 
                onClick={generateRandomCrosses}
                className="generate-button"
              >
                Generate Crosses
              </button>
              <button 
                onClick={clearCrosses}
                className="clear-button"
                disabled={crosses.length === 0}
              >
                Clear Crosses
              </button>
              <button 
                onClick={() => setRectangles([])}
                className="clear-button"
                disabled={rectangles.length === 0}
              >
                Clear Rectangles
              </button>
              <button 
                onClick={resetZoom}
                className="zoom-button"
                disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              >
                Reset Zoom
              </button>
            </div>
            <div className="zoom-info">
              <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
              <span className="zoom-hint">(Use mouse wheel to zoom in/out)</span>
            </div>
            <div className="instructions">
              <p><strong>Rectangle Controls:</strong></p>
              <ul>
                <li>Ctrl/Cmd + Drag to create a new rectangle</li>
                <li>Click and drag rectangle to move</li>
                <li>Drag green corners to resize</li>
                <li>Drag blue circle to rotate</li>
                <li>Drag anywhere else to pan the view</li>
              </ul>
            </div>
          </>
        )}
      </div>

      {imageUrl && (
        <div className="display-section">
          <div 
            className="canvas-container"
            ref={containerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: interactionMode ? (interactionMode === 'move' ? 'move' : 'crosshair') : (isPanning ? 'grabbing' : 'grab') }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Selected"
              style={{ display: 'none' }}
            />
            <canvas
              ref={canvasRef}
              className="image-canvas"
              style={{ 
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: '0 0'
              }}
            />
          </div>
          <p className="info-text">
            {crosses.length > 0 || rectangles.length > 0
              ? `Displaying ${crosses.length} cross(es) and ${rectangles.length} rectangle(s)`
              : 'No overlays'}
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
