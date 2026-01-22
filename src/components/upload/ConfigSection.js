import React from 'react';

/**
 * Configuration form for API settings
 */
const ConfigSection = ({
  apiBaseUrl,
  projectId,
  bearerToken,
  onApiBaseUrlChange,
  onProjectIdChange,
  onBearerTokenChange,
  onSave,
  onLoad,
  configSaved
}) => {
  return (
    <div className="config-section">
      <div className="config-group">
        <label htmlFor="api-base-url">API Base URL:</label>
        <input
          id="api-base-url"
          type="text"
          value={apiBaseUrl}
          onChange={(e) => onApiBaseUrlChange(e.target.value)}
          placeholder="https://www.cognex.com/api"
          className="config-input"
        />
      </div>
      
      <div className="config-group">
        <label htmlFor="project-id">Project ID:</label>
        <input
          id="project-id"
          type="text"
          value={projectId}
          onChange={(e) => onProjectIdChange(e.target.value)}
          placeholder="Enter project UUID"
          className="config-input"
        />
      </div>
      
      <div className="config-group">
        <label htmlFor="bearer-token">Bearer Token:</label>
        <input
          id="bearer-token"
          type="password"
          value={bearerToken}
          onChange={(e) => onBearerTokenChange(e.target.value)}
          placeholder="Enter your JWT token"
          className="config-input"
        />
      </div>
      
      <div className="config-buttons">
        <button 
          onClick={onSave}
          className="config-button save-button"
        >
          💾 Save Configuration
        </button>
        <button 
          onClick={onLoad}
          className="config-button load-button"
        >
          📂 Load Configuration
        </button>
        {configSaved && (
          <span className="config-saved-message">✓ Configuration saved!</span>
        )}
      </div>
    </div>
  );
};

export default ConfigSection;
