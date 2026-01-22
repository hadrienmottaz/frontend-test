import React, { useState } from 'react';
import './ImageUploader.css';

const ImageUploader = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);

    // Generate previews for selected images
    const previewUrls = files.map(file => URL.createObjectURL(file));
    setPreviews(previewUrls);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select at least one image to upload');
      return;
    }

    // Create FormData for file upload
    const formData = new FormData();
    selectedFiles.forEach((file, index) => {
      formData.append(`image_${index}`, file);
    });

    try {
      // TODO: Replace with actual API endpoint when backend is ready
      const apiEndpoint = '/api/upload'; // Placeholder endpoint
      
      // This is a placeholder - actual implementation will be added when API is available
      console.log('Uploading files to:', apiEndpoint);
      console.log('Files to upload:', selectedFiles);
      
      // Simulated upload response
      alert(`Ready to upload ${selectedFiles.length} image(s). API endpoint will be configured later.`);
      
      // Uncomment when API is ready:
      // const response = await fetch(apiEndpoint, {
      //   method: 'POST',
      //   body: formData
      // });
      // 
      // if (response.ok) {
      //   alert('Images uploaded successfully!');
      //   setSelectedFiles([]);
      //   setPreviews([]);
      // } else {
      //   alert('Upload failed');
      // }
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Error during upload');
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setPreviews([]);
  };

  return (
    <div className="image-uploader">
      <h2>Image Uploader</h2>
      <div className="upload-section">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="file-input"
        />
        <div className="button-group">
          <button 
            onClick={handleUpload} 
            disabled={selectedFiles.length === 0}
            className="upload-button"
          >
            Upload Images
          </button>
          <button 
            onClick={handleClear} 
            disabled={selectedFiles.length === 0}
            className="clear-button"
          >
            Clear
          </button>
        </div>
      </div>
      
      {selectedFiles.length > 0 && (
        <div className="preview-section">
          <h3>Selected Images ({selectedFiles.length})</h3>
          <div className="preview-grid">
            {previews.map((preview, index) => (
              <div key={index} className="preview-item">
                <img src={preview} alt={`Preview ${index + 1}`} />
                <p>{selectedFiles[index].name}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
