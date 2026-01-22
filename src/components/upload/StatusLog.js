import React from 'react';

/**
 * Status log display
 */
const StatusLog = ({ statuses }) => {
  if (statuses.length === 0) {
    return null;
  }

  return (
    <div className="status-section">
      <h3>Upload Status</h3>
      <div className="status-log">
        {statuses.map((status, index) => (
          <div key={index} className={`status-message ${status.type}`}>
            {status.message}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusLog;
