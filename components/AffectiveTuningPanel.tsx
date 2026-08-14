/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { 
  RotateCcw, 
  Sliders, 
  Sparkles, 
  Info,
  Layers,
  FileText,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { AffectiveTelemetry } from '../types';
import { AFFECTIVE_PRESETS, DEFAULT_AFFECTIVE_TELEMETRY, getAffectivePromptDirective } from '../utils/affectiveTelemetry';

interface AffectiveTuningPanelProps {
  telemetry: AffectiveTelemetry;
  onChange: (telemetry: AffectiveTelemetry) => void;
  activeDocumentTitle?: string;
  className?: string;
  onApplyToDocument?: (telemetry: AffectiveTelemetry) => void;
  onApplyToAllDocuments?: (telemetry: AffectiveTelemetry) => void;
  isApplying?: boolean;
}

interface SliderConfig {
  key: keyof Pick<AffectiveTelemetry, 'toneAuthority' | 'emotionalPolarity' | 'abstractionLevel' | 'proceduralAssertiveness'>;
  label: string;
  subLabels: string;
  helperText: string;
  lowLabel: string;
  midLabel: string;
  highLabel: string;
}

const SLIDER_CONFIGS: SliderConfig[] = [
  {
    key: 'toneAuthority',
    label: 'TONE AUTHORITY',
    subLabels: '0 = Deferential · 50 = Neutral · 100 = Authoritative',
    helperText: 'Controls expertise projection, modal verb selection, and imperative frequency',
    lowLabel: 'Deferential',
    midLabel: 'Neutral',
    highLabel: 'Authoritative'
  },
  {
    key: 'emotionalPolarity',
    label: 'EMOTIONAL POLARITY',
    subLabels: '0 = Negative · 50 = Neutral · 100 = Positive',
    helperText: 'Controls affective charge, encouragement level, and warning vs. praise framing',
    lowLabel: 'Negative',
    midLabel: 'Neutral',
    highLabel: 'Positive'
  },
  {
    key: 'abstractionLevel',
    label: 'ABSTRACTION LEVEL',
    subLabels: '0 = Concrete · 50 = Balanced · 100 = Abstract',
    helperText: 'Controls conceptual altitude, nominalization rate, and lexical density',
    lowLabel: 'Concrete',
    midLabel: 'Balanced',
    highLabel: 'Abstract'
  },
  {
    key: 'proceduralAssertiveness',
    label: 'PROCEDURAL ASSERTIVENESS',
    subLabels: '0 = Suggestive · 50 = Directive · 100 = Enforced',
    helperText: 'Controls directiveness, action orientation, and urgency markers',
    lowLabel: 'Suggestive',
    midLabel: 'Directive',
    highLabel: 'Enforced'
  }
];

export const AffectiveTuningPanel: React.FC<AffectiveTuningPanelProps> = ({
  telemetry,
  onChange,
  activeDocumentTitle,
  className = '',
  onApplyToDocument,
  onApplyToAllDocuments,
  isApplying = false
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Compute matched preset or 'Custom'
  const currentPresetName = useMemo(() => {
    for (const [presetName, values] of Object.entries(AFFECTIVE_PRESETS)) {
      if (
        telemetry.toneAuthority === values.toneAuthority &&
        telemetry.emotionalPolarity === values.emotionalPolarity &&
        telemetry.abstractionLevel === values.abstractionLevel &&
        telemetry.proceduralAssertiveness === values.proceduralAssertiveness
      ) {
        return presetName;
      }
    }
    return 'Custom';
  }, [telemetry]);

  const previewDirective = useMemo(() => {
    return getAffectivePromptDirective(telemetry);
  }, [telemetry]);

  const handleSliderChange = (key: SliderConfig['key'], value: number) => {
    const nextState: AffectiveTelemetry = {
      ...telemetry,
      [key]: value,
      activePreset: 'Custom'
    };
    onChange(nextState);
  };

  const handlePresetSelect = (presetName: string) => {
    if (presetName === 'Custom') {
      onChange({
        ...telemetry,
        activePreset: 'Custom'
      });
      return;
    }

    const presetValues = AFFECTIVE_PRESETS[presetName];
    if (presetValues) {
      onChange({
        ...telemetry,
        ...presetValues,
        activePreset: presetName
      });
    }
  };

  const handleToggleEnabled = () => {
    onChange({
      ...telemetry,
      enabled: !telemetry.enabled
    });
  };

  const handleReset = () => {
    onChange({
      ...DEFAULT_AFFECTIVE_TELEMETRY,
      enabled: telemetry.enabled
    });
  };

  return (
    <div className={`affective-tuning-panel ${className} ${!telemetry.enabled ? 'is-bypassed' : ''}`}>
      {/* Panel Header */}
      <div className="affective-header">
        <div className="affective-title-area">
          <div className="affective-icon-badge">
            <Sliders size={16} />
          </div>
          <div>
            <h2 className="affective-title">AFFECTIVE TUNING</h2>
            {activeDocumentTitle && (
              <span className="affective-doc-subtitle" title={activeDocumentTitle}>
                Target: {activeDocumentTitle}
              </span>
            )}
          </div>
        </div>

        <div className="affective-header-actions">
          {/* Apply to Document Button (Left of Active Switch) */}
          {onApplyToDocument && (
            <button
              type="button"
              className="affective-header-apply-btn primary"
              onClick={() => onApplyToDocument(telemetry)}
              disabled={isApplying || !telemetry.enabled}
              title={
                !telemetry.enabled
                  ? 'Enable Affective Tuning to apply'
                  : activeDocumentTitle 
                  ? `Apply affective style tuning to "${activeDocumentTitle}"` 
                  : 'Apply affective style tuning to this document'
              }
            >
              <FileText size={13} />
              <span>{isApplying ? 'Applying...' : 'Apply Doc'}</span>
            </button>
          )}

          {/* Apply to All Documents Button (Left of Active Switch) */}
          {onApplyToAllDocuments && (
            <button
              type="button"
              className="affective-header-apply-btn secondary"
              onClick={() => onApplyToAllDocuments(telemetry)}
              disabled={isApplying || !telemetry.enabled}
              title={
                !telemetry.enabled
                  ? 'Enable Affective Tuning to apply'
                  : 'Apply current affective styling across all documents in this workspace'
              }
            >
              <Layers size={13} />
              <span>Apply All</span>
            </button>
          )}

          {/* Master ACTIVE / BYPASS switch */}
          <button
            type="button"
            className={`affective-toggle-btn ${telemetry.enabled ? 'active' : 'bypassed'}`}
            onClick={handleToggleEnabled}
            title={telemetry.enabled ? 'Telemetry Active (Click to Bypass)' : 'Telemetry Bypassed (Click to Activate)'}
            aria-label="Toggle Affective Telemetry"
          >
            <span className="toggle-dot" />
            <span className="toggle-label">{telemetry.enabled ? 'ACTIVE' : 'BYPASS'}</span>
          </button>

          {/* Reset button */}
          <button
            type="button"
            className="affective-reset-btn"
            onClick={handleReset}
            title="Reset to defaults (50/50/50/50)"
            aria-label="Reset all sliders to defaults"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Preset Chips */}
      <div className="affective-presets-section">
        <div className="presets-label-row">
          <span className="section-mini-label">QUICK PRESETS</span>
          <span className="preset-current-indicator">
            {currentPresetName === 'Custom' ? 'Custom Dial' : `${currentPresetName} Profile`}
          </span>
        </div>

        <div className="preset-chips-row">
          {(['End User', 'Technician', 'IT Staff', 'Custom'] as const).map((preset) => {
            const isSelected = currentPresetName === preset;
            return (
              <button
                key={preset}
                type="button"
                className={`preset-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => handlePresetSelect(preset)}
              >
                {preset === 'End User' && <Sparkles size={12} />}
                {preset === 'Technician' && <Zap size={12} />}
                {preset === 'IT Staff' && <CheckCircle2 size={12} />}
                <span>{preset}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sliders Container */}
      <div className="affective-sliders-list">
        {SLIDER_CONFIGS.map((config) => {
          const value = telemetry[config.key];
          const isTooltipOpen = activeTooltip === config.key;

          return (
            <div key={config.key} className="affective-slider-group">
              <div className="slider-label-row">
                <div className="slider-title-wrapper">
                  <label htmlFor={`slider-${config.key}`} className="slider-label">
                    {config.label}
                  </label>
                  <button
                    type="button"
                    className="slider-help-trigger"
                    onClick={() => setActiveTooltip(isTooltipOpen ? null : config.key)}
                    onMouseEnter={() => setActiveTooltip(config.key)}
                    onMouseLeave={() => setActiveTooltip(null)}
                    title={config.helperText}
                    aria-label={`Info for ${config.label}`}
                  >
                    <Info size={12} />
                  </button>
                </div>
                <div className="slider-readout">
                  <span className="mono-readout">{value}</span>
                  <span className="readout-max"> / 100</span>
                </div>
              </div>

              {/* Slider Input with Dynamic Progress Fill */}
              <div className="slider-track-container">
                <div 
                  className="slider-fill-glow" 
                  style={{ width: `${value}%` }} 
                />
                <input
                  id={`slider-${config.key}`}
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={value}
                  onChange={(e) => handleSliderChange(config.key, parseInt(e.target.value, 10))}
                  className="affective-range-input"
                  aria-label={config.label}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={value}
                />
              </div>

              {/* Sub-labels (0, 50, 100) */}
              <div className="slider-sublabels-row">
                <span className="sublabel-item low">{config.lowLabel} (0)</span>
                <span className="sublabel-item mid">{config.midLabel} (50)</span>
                <span className="sublabel-item high">{config.highLabel} (100)</span>
              </div>

              {/* Helper Text */}
              <p className="slider-helper-text">
                {config.helperText}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AffectiveTuningPanel;
