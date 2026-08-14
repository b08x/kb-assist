/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { GenerationParams } from '../types';
import { Sliders, RotateCcw } from 'lucide-react';

interface GenParamsControlProps {
  params: GenerationParams;
  onChange: (params: GenerationParams) => void;
  onReset?: () => void;
}

export const GenParamsControl: React.FC<GenParamsControlProps> = ({
  params,
  onChange,
  onReset
}) => {
  const temperature = params.temperature ?? 0.7;
  const maxTokens = params.maxTokens ?? 4096;
  const topP = params.topP ?? 0.95;

  const handleReset = () => {
    if (onReset) {
      onReset();
    } else {
      onChange({ temperature: 0.7, maxTokens: 4096, topP: 0.95 });
    }
  };

  return (
    <div className="gen-params-container">
      <div className="params-header">
        <div className="params-title">
          <Sliders size={14} />
          <span>Generation Parameters</span>
        </div>
        <button
          type="button"
          className="reset-params-btn"
          onClick={handleReset}
          title="Reset to default values"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <div className="param-item">
        <div className="param-label-row">
          <label>Temperature</label>
          <span className="param-val-pill">{temperature.toFixed(2)}</span>
        </div>
        <div className="param-slider-row">
          <input
            type="range"
            min="0.0"
            max="1.5"
            step="0.05"
            value={temperature}
            onChange={(e) => onChange({ ...params, temperature: parseFloat(e.target.value) })}
          />
        </div>
        <span className="param-hint">Lower is more deterministic; higher is more creative.</span>
      </div>

      <div className="param-item">
        <div className="param-label-row">
          <label>Max Output Tokens</label>
          <span className="param-val-pill">{maxTokens.toLocaleString()}</span>
        </div>
        <div className="param-slider-row">
          <input
            type="range"
            min="512"
            max="16384"
            step="512"
            value={maxTokens}
            onChange={(e) => onChange({ ...params, maxTokens: parseInt(e.target.value, 10) })}
          />
        </div>
        <span className="param-hint">Maximum length of the generated document.</span>
      </div>

      <div className="param-item">
        <div className="param-label-row">
          <label>Top P (Nucleus Sampling)</label>
          <span className="param-val-pill">{topP.toFixed(2)}</span>
        </div>
        <div className="param-slider-row">
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={topP}
            onChange={(e) => onChange({ ...params, topP: parseFloat(e.target.value) })}
          />
        </div>
        <span className="param-hint">Probability threshold for token selection.</span>
      </div>
    </div>
  );
};

export default GenParamsControl;
