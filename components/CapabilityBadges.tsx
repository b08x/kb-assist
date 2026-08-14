/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ModelCapabilities } from '../types';
import { Wrench, FileCode, Eye, Globe, Layers } from 'lucide-react';

interface CapabilityBadgesProps {
  capabilities?: ModelCapabilities;
  contextWindow?: number;
  compact?: boolean;
}

export const CapabilityBadges: React.FC<CapabilityBadgesProps> = ({
  capabilities,
  contextWindow,
  compact = false
}) => {
  if (!capabilities) return null;

  const formatContext = (tokens?: number) => {
    if (!tokens) return null;
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M`;
    if (tokens >= 1000) return `${Math.round(tokens / 1000)}k`;
    return `${tokens}`;
  };

  const contextStr = formatContext(contextWindow);

  return (
    <div className={`capability-badges-row ${compact ? 'compact' : ''}`}>
      {contextStr && (
        <span className="cap-badge context" title={`Context window: ${contextWindow?.toLocaleString()} tokens`}>
          <Layers size={11} /> {contextStr}
        </span>
      )}
      {capabilities.tools && (
        <span className="cap-badge tools" title="Function & Tool Calling Supported">
          <Wrench size={11} /> {compact ? 'Tools' : 'Tools'}
        </span>
      )}
      {capabilities.structuredOutputs && (
        <span className="cap-badge structured" title="Structured Outputs / JSON Schema Supported">
          <FileCode size={11} /> {compact ? 'JSON' : 'Structured'}
        </span>
      )}
      {capabilities.vision && (
        <span className="cap-badge vision" title="Multimodal Vision Supported">
          <Eye size={11} /> Vision
        </span>
      )}
      {capabilities.webSearch && (
        <span className="cap-badge websearch" title="Real-time Web Search Grounding Supported">
          <Globe size={11} /> Search
        </span>
      )}
    </div>
  );
};

export default CapabilityBadges;
