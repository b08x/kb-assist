/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { ModelInfo } from '../types';
import CapabilityBadges from './CapabilityBadges';
import { ChevronDown, Search, Cpu } from 'lucide-react';

interface ModelSelectorProps {
  models: ModelInfo[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  models,
  selectedModelId,
  onSelectModel,
  disabled = false,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find(m => m.id === selectedModelId) || (models.length > 0 ? models[0] : null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredModels = models.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={`custom-model-selector ${compact ? 'compact' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        className={`model-selector-trigger ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <div className="trigger-content">
          <Cpu size={14} className="model-icon" />
          <span className="model-name-text">
            {selectedModel ? selectedModel.name || selectedModel.id : 'No models synced'}
          </span>
          {selectedModel && (
            <CapabilityBadges 
              capabilities={selectedModel.capabilities} 
              contextWindow={selectedModel.contextWindow}
              compact
            />
          )}
        </div>
        <ChevronDown size={14} className={`chevron-icon ${isOpen ? 'rotated' : ''}`} />
      </button>

      {isOpen && (
        <div className="model-dropdown-menu">
          {models.length > 6 && (
            <div className="dropdown-search-wrapper">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          
          <div className="model-options-list">
            {filteredModels.length === 0 ? (
              <div className="no-models-msg">
                {models.length === 0 ? 'No models available. Sync in Settings.' : 'No matching models found.'}
              </div>
            ) : (
              filteredModels.map(model => (
                <div
                  key={model.id}
                  className={`model-option-item ${model.id === selectedModel?.id ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectModel(model.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <div className="option-header">
                    <span className="option-title">{model.name || model.id}</span>
                    {model.name !== model.id && (
                      <span className="option-id-sub">{model.id}</span>
                    )}
                  </div>
                  <CapabilityBadges 
                    capabilities={model.capabilities} 
                    contextWindow={model.contextWindow}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
