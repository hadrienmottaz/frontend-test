import React from 'react';
import { formatThroughput } from '../../utils/adaptiveConcurrency';

/**
 * Progress display with throughput and timing info
 */
const ProgressSection = ({
  overallProgress,
  elapsedTime,
  estimatedTimeRemaining,
  throughput,
  concurrency
}) => {
  return (
    <div className="progress-section">
      <div className="progress-header">
        <h3>Overall Progress</h3>
        <div className="time-info">
          <span className="time-elapsed">
            ⏱️ {elapsedTime.toFixed(1)}s
          </span>
          {throughput > 0 && (
            <span className="throughput-info">
              📊 {formatThroughput(throughput)}
            </span>
          )}
          {concurrency > 0 && (
            <span className="concurrency-info">
              🔄 {concurrency} concurrent
            </span>
          )}
          {estimatedTimeRemaining > 0 && overallProgress < 100 && (
            <span className="time-remaining">
              ⏳ ~{estimatedTimeRemaining.toFixed(1)}s remaining
            </span>
          )}
        </div>
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar overall" 
          style={{ width: `${overallProgress}%` }}
        >
          <span className="progress-text">{Math.round(overallProgress)}%</span>
        </div>
      </div>
    </div>
  );
};

export default ProgressSection;
