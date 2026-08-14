import React, { useState } from 'react';
import { Copy, Check, Terminal, Info, Zap } from 'lucide-react';
import { AffectiveTelemetry } from '../types';
import { getAffectivePromptDirective } from '../utils/affectiveTelemetry';

interface LivePromptPreviewProps {
  telemetry: AffectiveTelemetry;
  activeDocumentTitle?: string;
}

export const LivePromptPreview: React.FC<LivePromptPreviewProps> = ({
  telemetry,
  activeDocumentTitle
}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const directive = getAffectivePromptDirective(telemetry);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(directive);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="prompt-preview-tab-panel">
      <div className="prompt-preview-header">
        <div className="preview-header-left">
          <div className="preview-icon-badge">
            <Terminal size={15} />
          </div>
          <div>
            <h3 className="preview-header-title">LIVE PROMPT INJECTION</h3>
            <span className="preview-header-subtitle">
              {activeDocumentTitle ? `Target: ${activeDocumentTitle}` : 'Global Context'}
            </span>
          </div>
        </div>

        <div className="preview-header-right">
          <span className={`injection-status-pill ${telemetry.enabled ? 'active' : 'bypassed'}`}>
            <span className="status-dot" />
            {telemetry.enabled ? 'ACTIVE' : 'BYPASSED'}
          </span>
          <button
            type="button"
            className="preview-copy-action-btn"
            onClick={handleCopy}
            title="Copy prompt directive to clipboard"
          >
            {isCopied ? <Check size={13} /> : <Copy size={13} />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="prompt-preview-content">
        <div className="preview-info-box">
          <Info size={14} className="info-icon" />
          <span>
            {telemetry.enabled
              ? 'This affective directive block is automatically appended to system instructions on document refinement, generation, and targeted edits.'
              : 'Affective tuning is currently bypassed. Directives will NOT be appended until activated.'}
          </span>
        </div>

        <div className="prompt-preview-card">
          <div className="card-top-bar">
            <span className="file-badge">system_instruction_context.txt</span>
            <span className="preset-indicator">Preset: {telemetry.activePreset || 'Custom'}</span>
          </div>
          <pre className="prompt-code-display">
            <code>{directive}</code>
          </pre>
        </div>

        <div className="active-parameters-summary">
          <div className="summary-title">
            <Zap size={13} />
            <span>Active Vector Summary</span>
          </div>
          <div className="param-grid">
            <div className="param-cell">
              <span className="cell-label">Tone Authority</span>
              <span className="cell-value">{telemetry.toneAuthority}/100</span>
            </div>
            <div className="param-cell">
              <span className="cell-label">Emotional Polarity</span>
              <span className="cell-value">{telemetry.emotionalPolarity}/100</span>
            </div>
            <div className="param-cell">
              <span className="cell-label">Abstraction Level</span>
              <span className="cell-value">{telemetry.abstractionLevel}/100</span>
            </div>
            <div className="param-cell">
              <span className="cell-label">Procedural Assertiveness</span>
              <span className="cell-value">{telemetry.proceduralAssertiveness}/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivePromptPreview;
