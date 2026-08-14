
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useMemo, useCallback } from 'react';
import { Artifact, AIProvider, AffectiveTelemetry } from '../types';
import Editor from './Editor';
import { AlertTriangle, RotateCcw, Sparkles, Settings } from 'lucide-react';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused: boolean;
    onClick: () => void;
    isEditing?: boolean;
    onUpdate?: (newHtml: string) => void;
    onRetry?: (artifact: Artifact) => void;
    onSwitchToGemini?: () => void;
    onOpenSettings?: () => void;
    affectiveTelemetry?: AffectiveTelemetry;
    onApplyAffectiveTuning?: (options: { scope: 'selection' | 'all'; selectedText?: string; selectedHtml?: string }) => Promise<void> | void;
    isApplyingTuning?: boolean;
}

const ArtifactCard = React.memo(({ 
    artifact, 
    isFocused, 
    onClick,
    isEditing = false,
    onUpdate,
    onRetry,
    onSwitchToGemini,
    onOpenSettings,
    affectiveTelemetry,
    onApplyAffectiveTuning,
    isApplyingTuning
}: ArtifactCardProps) => {
    const isBlurring = artifact.status === 'streaming';
    const isError = artifact.status === 'error';

    // Robust extraction of styles and content to prevent formatting loss during editing
    const { stylePart, bodyContent } = useMemo(() => {
        const html = artifact.html || '';
        
        // Extract all style tags content
        const styleRegex = /<style>[\s\S]*?<\/style>/gi;
        const styles = html.match(styleRegex) || [];
        const stylePart = styles.join('\n');
        
        // Clean content for the editor by stripping layout tags and styles
        let cleanBody = html.replace(styleRegex, '');
        // Remove standard HTML boilerplate to avoid editor confusion, but keep them for re-wrapping
        cleanBody = cleanBody.replace(/<!DOCTYPE html>|<html>|<\/html>|<head>|<\/head>|<body>|<\/body>/gi, '').trim();

        return { stylePart, bodyContent: cleanBody };
    }, [artifact.html]);

    const handleEditUpdate = useCallback((newBodyHtml: string) => {
        if (onUpdate) {
            // Re-assemble the full document with preserved styles and basic boilerplate
            const updatedHtml = `<!DOCTYPE html><html><head>${stylePart}</head><body>${newBodyHtml}</body></html>`;
            // Only update if the content has actually changed to prevent loops
            if (updatedHtml !== artifact.html) {
                onUpdate(updatedHtml);
            }
        }
    }, [onUpdate, stylePart, artifact.html]);

    return (
        <div 
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isBlurring ? 'generating' : ''} ${isEditing ? 'editing' : ''} ${isError ? 'has-error' : ''}`}
            onClick={onClick}
        >
            <div className="artifact-header">
                <span className="artifact-style-tag">{artifact.styleName}</span>
                {isBlurring && <span className="status-indicator drafting">Drafting...</span>}
                {isEditing && <span className="status-indicator editing">Editing Mode</span>}
                {isError && <span className="status-indicator error-badge">Generation Error</span>}
            </div>
            <div className="artifact-card-inner">
                {isBlurring && (
                    <div className="generating-loader-overlay">
                        <div className="loader-bars">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                )}
                
                {isError ? (
                    <div className="artifact-error-container" onClick={(e) => e.stopPropagation()}>
                        <div className="artifact-error-icon">
                            <AlertTriangle size={28} />
                        </div>
                        <h4 className="artifact-error-title">Documentation Generation Failed</h4>
                        <p className="artifact-error-desc">
                            {artifact.error || (artifact.html && artifact.html.replace(/<[^>]*>?/gm, '').trim()) || 'The selected AI provider encountered an error while processing the request.'}
                        </p>
                        {artifact.provider && (
                            <div className="artifact-error-meta">
                                <span>Provider: <strong>{artifact.provider}</strong></span>
                                {artifact.modelId && <span>Model: <strong>{artifact.modelId}</strong></span>}
                            </div>
                        )}
                        <div className="artifact-error-actions">
                            {onRetry && (
                                <button 
                                    className="artifact-btn primary"
                                    onClick={() => onRetry(artifact)}
                                    title="Retry generation for this document"
                                >
                                    <RotateCcw size={14} /> Retry Generation
                                </button>
                            )}
                            {onSwitchToGemini && artifact.provider !== 'gemini' && (
                                <button 
                                    className="artifact-btn secondary"
                                    onClick={onSwitchToGemini}
                                    title="Switch to Google Gemini (Managed Server Key)"
                                >
                                    <Sparkles size={14} /> Switch to Gemini
                                </button>
                            )}
                            {onOpenSettings && (
                                <button 
                                    className="artifact-btn subtle"
                                    onClick={onOpenSettings}
                                    title="Configure API Keys in Settings"
                                >
                                    <Settings size={14} /> Configure Keys
                                </button>
                            )}
                        </div>
                    </div>
                ) : isEditing && onUpdate ? (
                    <Editor 
                        content={bodyContent} 
                        onUpdate={handleEditUpdate} 
                        affectiveTelemetry={affectiveTelemetry}
                        onApplyAffectiveTuning={onApplyAffectiveTuning}
                        isApplyingTuning={isApplyingTuning}
                    />
                ) : (
                    <iframe 
                        srcDoc={artifact.html} 
                        title={artifact.id} 
                        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                        className="artifact-iframe"
                    />
                )}
            </div>
        </div>
    );
});

export default ArtifactCard;