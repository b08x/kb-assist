/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AIProvider, GenerationParams, ProviderSyncState } from '../types';
import { PROVIDER_CONFIGS } from '../adapters';
import { verifyProviderKey, syncProviderModels } from '../services/aiService';
import GenParamsControl from './GenParamsControl';
import { 
  X, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  ShieldCheck, 
  ExternalLink, 
  Server, 
  Sliders, 
  Sparkles,
  Database,
  Lock,
  Clock
} from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProvider: AIProvider;
  onSelectProvider: (provider: AIProvider) => void;
  modelCache: Record<AIProvider, ProviderSyncState>;
  onUpdateModelCache: (cache: Record<AIProvider, ProviderSyncState>) => void;
  secretsStatus: Record<AIProvider, { hasServerKey: boolean; isBaseUrl?: boolean }>;
  customKeys: Record<AIProvider, string>;
  onUpdateCustomKey: (provider: AIProvider, key: string) => void;
  genParams: GenerationParams;
  onUpdateGenParams: (params: GenerationParams) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  activeProvider,
  onSelectProvider,
  modelCache,
  onUpdateModelCache,
  secretsStatus,
  customKeys,
  onUpdateCustomKey,
  genParams,
  onUpdateGenParams
}) => {
  const [selectedTab, setSelectedTab] = useState<'providers' | 'params'>('providers');
  const [verifying, setVerifying] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Input state for key entering - never initialized with stored key values
  const [tempKeyInput, setTempKeyInput] = useState('');

  if (!isOpen) return null;

  const currentProviderConfig = PROVIDER_CONFIGS[activeProvider];
  const currentSyncState = modelCache[activeProvider];
  const serverConfigured = secretsStatus[activeProvider]?.hasServerKey;
  const isCustomKeySet = Boolean(customKeys[activeProvider]);

  const handleProviderSwitch = (provider: AIProvider) => {
    onSelectProvider(provider);
    setVerifyMessage(null);
    setTempKeyInput(provider === 'ollama' ? (customKeys.ollama || 'http://localhost:11434') : '');
  };

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const keyToVerify = tempKeyInput || customKeys[activeProvider];
      const result = await verifyProviderKey(activeProvider, keyToVerify);
      if (result.valid) {
        setVerifyMessage({ type: 'success', text: 'API Key / Connection verified successfully!' });
        if (tempKeyInput) {
          onUpdateCustomKey(activeProvider, tempKeyInput);
        }
        // Automatically sync models after successful verification
        handleSyncModels(keyToVerify);
      } else {
        setVerifyMessage({ type: 'error', text: result.error || 'Verification failed. Please check credentials.' });
      }
    } catch (e: any) {
      setVerifyMessage({ type: 'error', text: e.message || 'Verification connection failed.' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSyncModels = async (keyOverride?: string) => {
    setSyncing(true);
    try {
      const key = keyOverride || tempKeyInput || customKeys[activeProvider];
      const models = await syncProviderModels(activeProvider, key);
      const updatedCache: Record<AIProvider, ProviderSyncState> = {
        ...modelCache,
        [activeProvider]: {
          lastSynced: Date.now(),
          models,
          isVerified: true,
          error: null
        }
      };
      onUpdateModelCache(updatedCache);
      setVerifyMessage({
        type: 'success',
        text: `Successfully synced ${models.length} model${models.length === 1 ? '' : 's'} with capabilities!`
      });
      // Clear key input after saving to ensure zero echo back
      if (activeProvider !== 'ollama') {
        setTempKeyInput('');
      }
    } catch (e: any) {
      setVerifyMessage({ type: 'error', text: e.message || 'Failed to sync models.' });
    } finally {
      setSyncing(false);
    }
  };

  const formatLastSynced = (timestamp?: number) => {
    if (!timestamp) return 'Never synced';
    const date = new Date(timestamp);
    return `${date.toLocaleDateString()} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  };

  return (
    <div className="settings-modal-backdrop" onClick={onClose}>
      <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="settings-modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="modal-title">Provider & Generation Engine</h2>
              <p className="modal-subtitle">Configure AI model providers, credentials, and generation parameters.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close Settings">
            <X size={18} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="settings-tabs-bar">
          <button
            className={`settings-tab-btn ${selectedTab === 'providers' ? 'active' : ''}`}
            onClick={() => setSelectedTab('providers')}
          >
            <Database size={15} />
            <span>AI Providers & Sync</span>
          </button>
          <button
            className={`settings-tab-btn ${selectedTab === 'params' ? 'active' : ''}`}
            onClick={() => setSelectedTab('params')}
          >
            <Sliders size={15} />
            <span>Generation Parameters</span>
          </button>
        </div>

        <div className="settings-modal-body">
          {selectedTab === 'providers' ? (
            <div className="providers-config-layout">
              {/* Provider Selector sidebar */}
              <div className="providers-sidebar">
                <div className="sidebar-section-title">Select Provider</div>
                <div className="provider-list-buttons">
                  {(Object.keys(PROVIDER_CONFIGS) as AIProvider[]).map((provId) => {
                    const cfg = PROVIDER_CONFIGS[provId];
                    const isSelected = activeProvider === provId;
                    const hasServer = secretsStatus[provId]?.hasServerKey;
                    const hasCustom = Boolean(customKeys[provId]);
                    const isReady = hasServer || hasCustom || (provId === 'gemini' || provId === 'ollama');

                    return (
                      <button
                        key={provId}
                        type="button"
                        className={`provider-select-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleProviderSwitch(provId)}
                      >
                        <div className="provider-card-main">
                          <span className="provider-name">{cfg.name}</span>
                          <span className={`provider-status-dot ${isReady ? 'ready' : 'unconfigured'}`} />
                        </div>
                        <div className="provider-card-sub">
                          {hasServer ? (
                            <span className="server-managed-tag">Server Secret</span>
                          ) : hasCustom ? (
                            <span className="custom-key-tag">Custom Key</span>
                          ) : provId === 'ollama' ? (
                            <span className="local-tag">Local Instance</span>
                          ) : (
                            <span className="pending-tag">Not configured</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider Config Detail Area */}
              <div className="provider-detail-panel">
                <div className="provider-detail-header">
                  <div className="provider-info-meta">
                    <h3 className="provider-detail-title">{currentProviderConfig.name}</h3>
                    <p className="provider-detail-desc">{currentProviderConfig.description}</p>
                  </div>
                  <a
                    href={currentProviderConfig.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="provider-docs-link"
                  >
                    <span>API Docs</span>
                    <ExternalLink size={13} />
                  </a>
                </div>

                {/* Connection Status Banner (Never echoes secrets!) */}
                <div className="connection-status-card">
                  <div className="status-indicator-col">
                    {serverConfigured ? (
                      <div className="status-badge connected">
                        <Server size={14} />
                        <span>Connected via Server Environment</span>
                      </div>
                    ) : isCustomKeySet ? (
                      <div className="status-badge custom">
                        <Lock size={14} />
                        <span>Custom Credential Active</span>
                      </div>
                    ) : activeProvider === 'ollama' ? (
                      <div className="status-badge local">
                        <Database size={14} />
                        <span>Local Instance (Direct / Proxy)</span>
                      </div>
                    ) : (
                      <div className="status-badge unconfigured">
                        <ShieldCheck size={14} />
                        <span>No Secret Configured</span>
                      </div>
                    )}
                  </div>
                  <p className="status-note">
                    {serverConfigured
                      ? 'This key is securely managed server-side. Requests will authenticate through the backend without exposing credentials in the browser.'
                      : 'You can provide an API key override below. For security, keys are never displayed back after entry.'}
                  </p>
                </div>

                {/* Key Input Section */}
                <div className="key-input-form-group">
                  <label className="key-input-label">
                    {currentProviderConfig.keyLabel}
                    {serverConfigured && <span className="override-hint">(Override Server Key)</span>}
                  </label>
                  <div className="key-input-row">
                    <input
                      type={currentProviderConfig.isBaseUrl ? 'text' : 'password'}
                      value={tempKeyInput}
                      onChange={(e) => setTempKeyInput(e.target.value)}
                      placeholder={
                        serverConfigured
                          ? '•••••••••••••••• (Server Key Active)'
                          : isCustomKeySet
                          ? '•••••••••••••••• (Custom Key Saved)'
                          : currentProviderConfig.keyPlaceholder
                      }
                      className="key-text-input"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      className="verify-key-btn"
                      onClick={handleVerify}
                      disabled={verifying}
                    >
                      {verifying ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={14} />
                          <span>Verify Key</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Verification Feedback Message */}
                {verifyMessage && (
                  <div className={`verify-msg-banner ${verifyMessage.type}`}>
                    {verifyMessage.type === 'success' ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <XCircle size={15} />
                    )}
                    <span>{verifyMessage.text}</span>
                  </div>
                )}

                {/* Model Sync Section */}
                <div className="models-sync-section">
                  <div className="sync-header-row">
                    <div>
                      <div className="sync-title">Model Catalog & Capabilities</div>
                      <div className="sync-meta-timestamp">
                        <Clock size={12} />
                        <span>Last synced: {formatLastSynced(currentSyncState?.lastSynced)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="sync-models-btn"
                      onClick={() => handleSyncModels()}
                      disabled={syncing}
                    >
                      <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                      <span>{syncing ? 'Syncing...' : 'Sync Models'}</span>
                    </button>
                  </div>

                  <div className="synced-models-summary">
                    <div className="synced-count-pill">
                      <strong>{currentSyncState?.models.length || 0}</strong> models available
                    </div>
                    {currentSyncState?.models && currentSyncState.models.length > 0 ? (
                      <div className="synced-models-preview-list">
                        {currentSyncState.models.slice(0, 4).map((m) => (
                          <div key={m.id} className="preview-model-tag">
                            <span className="preview-model-name">{m.name || m.id}</span>
                            {m.capabilities.vision && <span className="mini-cap-tag">Vision</span>}
                            {m.capabilities.tools && <span className="mini-cap-tag">Tools</span>}
                          </div>
                        ))}
                        {currentSyncState.models.length > 4 && (
                          <span className="more-models-text">
                            +{currentSyncState.models.length - 4} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="no-sync-notice">
                        Click "Sync Models" to populate real-time models and capabilities from {currentProviderConfig.name}.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="params-tab-wrapper">
              <GenParamsControl
                params={genParams}
                onChange={onUpdateGenParams}
                onReset={() => onUpdateGenParams({ temperature: 0.7, maxTokens: 4096, topP: 0.95 })}
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="settings-modal-footer">
          <div className="footer-left-info">
            <span>Provider: <strong>{currentProviderConfig.name}</strong></span>
          </div>
          <button className="footer-done-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
