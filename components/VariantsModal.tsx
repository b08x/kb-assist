/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Artifact, AIProvider, GenerationParams } from '../types';
import { TEMPLATE_REGISTRY, DOC_TEMPLATES } from '../constants';
import { nonStreamGeneration, streamGeneration } from '../services/aiService';
import { 
  X, 
  Sparkles, 
  Users, 
  BookOpen, 
  HelpCircle, 
  Zap, 
  Compass, 
  ShieldAlert, 
  FileText, 
  Check, 
  PlusCircle, 
  Eye, 
  ArrowRight, 
  Layers, 
  Maximize2,
  RefreshCw,
  Sliders,
  AlertCircle
} from 'lucide-react';

interface VariantItem {
  name: string;
  audience?: string;
  description?: string;
  html: string;
}

interface VariantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  focusedArtifact: Artifact | null;
  sessionPrompt: string;
  activeProvider: AIProvider;
  activeModel: string;
  customKeys: Record<AIProvider, string>;
  genParams: GenerationParams;
  onApplyVariant: (html: string, variantName: string) => void;
  onAddAsNewDocument: (html: string, title: string) => void;
  onGenerateDirectTemplate: (templateId: string) => void;
}

const AUDIENCE_PRESETS = [
  {
    id: 'user_suite',
    title: 'User Documentation Suite',
    category: 'user',
    icon: Users,
    badge: 'Recommended for End-Users',
    description: 'Generates 3 non-technical, user-friendly documents: Step-by-step User Manual, Self-Service FAQ, and QuickStart Cheat Sheet.',
    promptPrompt: '1) Plain-English End-User Manual with visual cues, 2) Self-Service User FAQ & Troubleshooting, 3) 1-Page QuickStart Reference Card with key shortcuts and dos/donts.'
  },
  {
    id: 'standard_audiences',
    title: 'Standard Enterprise Audiences',
    category: 'audiences',
    icon: Layers,
    badge: '3-Tier Stakeholder View',
    description: 'Generates 3 tailored perspectives: Executive 1-page Briefing, Deep Technical Specification, and End-User Quick Guide.',
    promptPrompt: '1) Executive Briefing for leadership, 2) Deep Technical Engineering Specification, 3) User-Friendly Quick Guide.'
  },
  {
    id: 'field_ops',
    title: 'Regional & Field Deployments',
    category: 'audiences',
    icon: Compass,
    badge: 'Operational Detours',
    description: 'Generates versions adapted for Central HQ Operations, Remote Field Technicians, and 24/7 Datacenter On-Call Engineers.',
    promptPrompt: '1) HQ Primary Operations Standard, 2) Remote / Field Low-Bandwidth Technician Guide, 3) 24/7 Datacenter Emergency On-Call Runbook.'
  },
  {
    id: 'security_compliance',
    title: 'Security, Audit & Compliance',
    category: 'compliance',
    icon: ShieldAlert,
    badge: 'Hardening & Governance',
    description: 'Generates Compliance Audit Evidence, Hardened Security Runbook, and End-User Safe Computing Policy.',
    promptPrompt: '1) Compliance & Audit Verification Sheet, 2) Zero-Trust Hardening Runbook, 3) User Safe-Computing & Incident Reporting Guide.'
  }
];

export const VariantsModal: React.FC<VariantsModalProps> = ({
  isOpen,
  onClose,
  focusedArtifact,
  sessionPrompt,
  activeProvider,
  activeModel,
  customKeys,
  genParams,
  onApplyVariant,
  onAddAsNewDocument,
  onGenerateDirectTemplate
}) => {
  const [activeTab, setActiveTab] = useState<'user_docs' | 'audiences' | 'custom'>('user_docs');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('user_suite');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [previewVariant, setPreviewVariant] = useState<VariantItem | null>(null);
  const [appliedVariantName, setAppliedVariantName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setAppliedVariantName(null);
    }
  }, [isOpen, focusedArtifact]);

  if (!isOpen) return null;

  const userTemplates = DOC_TEMPLATES.filter(t => t.category === 'user');
  const techTemplates = DOC_TEMPLATES.filter(t => t.category === 'technical');

  const handleGenerateVariants = async () => {
    if (!focusedArtifact) {
      setErrorMessage('No document selected. Please select a document in your workspace first.');
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setVariants([]);
    setAppliedVariantName(null);

    try {
      const apiKey = customKeys[activeProvider];
      let instructionsGoal = '';

      if (activeTab === 'custom' && customPrompt.trim()) {
        instructionsGoal = customPrompt.trim();
      } else {
        const preset = AUDIENCE_PRESETS.find(p => p.id === selectedPresetId) || AUDIENCE_PRESETS[0];
        instructionsGoal = preset.promptPrompt;
      }

      setGenerationProgress('Analyzing document structure & technical ontology...');

      const promptText = `
You are a senior enterprise technical scribe and documentation architect.
Generate 3 distinct, high-impact document variations adapted from the original document for different audiences or formats.

AUDIENCE & VARIANT SPECIFICATION:
${instructionsGoal}

ORIGINAL TOPIC: "${sessionPrompt}"
ORIGINAL DOCUMENT HTML:
${focusedArtifact.html}

REQUIREMENTS FOR EACH VARIANT:
1. Complete, self-contained, valid HTML starting with <!DOCTYPE html> with embedded <style> tags and clear headings.
2. Distinct persona, tone, and depth matching the target audience.
3. Plain-English, empathetic, step-by-step clarity for user-facing variants.

OUTPUT FORMAT:
Return a STRICT JSON array of objects with the exact schema:
[
  {
    "name": "Descriptive Variant Title (e.g. End-User QuickStart Guide)",
    "audience": "Target Audience (e.g. Non-Technical Employees)",
    "description": "1-sentence summary of how this variant was adapted.",
    "html": "<!DOCTYPE html><html>...</html>"
  }
]
Output ONLY the JSON array without markdown backticks or commentary.
`;

      setGenerationProgress('Synthesizing variant drafts across audience levels...');

      const result = await nonStreamGeneration(
        activeProvider,
        activeModel,
        { user: promptText },
        genParams,
        apiKey
      );

      let parsedVariants: VariantItem[] = [];

      if (result.object && Array.isArray(result.object)) {
        parsedVariants = result.object;
      } else if (result.text) {
        // Try extracting JSON
        const rawText = result.text.trim();
        const jsonMatch = rawText.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            parsedVariants = JSON.parse(jsonMatch[0]);
          } catch (err) {
            console.warn('JSON match parsing failed, trying raw:', err);
          }
        }

        if (parsedVariants.length === 0) {
          try {
            parsedVariants = JSON.parse(rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
          } catch (err) {
            console.warn('Raw text parsing failed:', err);
          }
        }
      }

      if (parsedVariants.length > 0) {
        setVariants(parsedVariants);
      } else {
        throw new Error('Unable to parse generated variants. Please retry with a standard model like Gemini 2.5 Flash.');
      }
    } catch (err: any) {
      console.error('Error generating variants:', err);
      setErrorMessage(err.message || 'Failed to generate document variations. Please check your model and key settings.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleApply = (variant: VariantItem) => {
    onApplyVariant(variant.html, variant.name);
    setAppliedVariantName(variant.name);
  };

  const handleAddAsNew = (variant: VariantItem) => {
    onAddAsNewDocument(variant.html, variant.name);
    setAppliedVariantName(`Added "${variant.name}" to workspace!`);
  };

  return (
    <div className="variants-modal-overlay" onClick={onClose}>
      <div className="variants-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="variants-modal-header">
          <div className="modal-header-left">
            <div className="modal-icon-pill">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="variants-modal-title">Document Variants & User Documentation</h2>
              <p className="variants-modal-subtitle">
                {focusedArtifact 
                  ? `Adapting "${focusedArtifact.styleName}" for end-users, management, or field teams.`
                  : 'Select an audience adaptation preset or create new user documentation.'}
              </p>
            </div>
          </div>
          <button className="variants-modal-close" onClick={onClose} title="Close Modal">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="variants-modal-tabs">
          <button 
            className={`variants-tab-btn ${activeTab === 'user_docs' ? 'active' : ''}`}
            onClick={() => { setActiveTab('user_docs'); setSelectedPresetId('user_suite'); }}
          >
            <Users size={16} /> User Documentation
          </button>
          <button 
            className={`variants-tab-btn ${activeTab === 'audiences' ? 'active' : ''}`}
            onClick={() => { setActiveTab('audiences'); setSelectedPresetId('standard_audiences'); }}
          >
            <Layers size={16} /> Audience Presets
          </button>
          <button 
            className={`variants-tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            <Sliders size={16} /> Custom Persona & Tone
          </button>
        </div>

        {/* Modal Body */}
        <div className="variants-modal-body">
          {/* Quick Direct User Doc Templates Bar */}
          <div className="user-templates-section">
            <div className="section-label-row">
              <span className="section-label">Direct User Documentation Templates</span>
              <span className="section-hint">Instant 1-click generation from current topic</span>
            </div>
            <div className="user-templates-grid">
              {userTemplates.map(template => {
                const IconComponent = template.id === 'usermanual' ? BookOpen :
                                      template.id === 'userfaq' ? HelpCircle :
                                      template.id === 'onboarding' ? Compass :
                                      template.id === 'quickstart' ? Zap : ShieldAlert;
                return (
                  <button
                    key={template.id}
                    className="user-template-card"
                    onClick={() => {
                      onGenerateDirectTemplate(template.id);
                      onClose();
                    }}
                    title={`Generate ${template.name}`}
                  >
                    <div className="template-card-icon-wrap">
                      <IconComponent size={18} />
                    </div>
                    <div className="template-card-text">
                      <span className="template-name">{template.name}</span>
                      <span className="template-desc">{template.description}</span>
                    </div>
                    <ArrowRight size={14} className="template-arrow" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="variants-divider" />

          {/* Preset Selection or Custom Input */}
          {activeTab !== 'custom' ? (
            <div className="presets-selector-wrap">
              <div className="section-label-row">
                <span className="section-label">Select Variant Adaptation Preset</span>
                <span className="active-model-pill">
                  Model: {activeModel} ({activeProvider})
                </span>
              </div>
              <div className="presets-grid">
                {AUDIENCE_PRESETS.filter(p => activeTab === 'user_docs' ? (p.category === 'user' || p.category === 'compliance') : true).map(preset => {
                  const Icon = preset.icon;
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <div 
                      key={preset.id}
                      className={`preset-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedPresetId(preset.id)}
                    >
                      <div className="preset-card-top">
                        <div className="preset-icon-box">
                          <Icon size={18} />
                        </div>
                        <span className="preset-badge">{preset.badge}</span>
                      </div>
                      <h3 className="preset-title">{preset.title}</h3>
                      <p className="preset-desc">{preset.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="custom-prompt-wrap">
              <div className="section-label-row">
                <span className="section-label">Custom Audience & Tone Instructions</span>
                <span className="section-hint">Define specific personas, compliance filters, or reading levels</span>
              </div>
              <textarea
                className="custom-prompt-textarea"
                rows={3}
                placeholder="Example: Generate 3 variants: 1) A simplified 1-page guide for retail store managers, 2) A checklist for helpdesk tier-1 agents, 3) An executive summary for the VP of Operations."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
              />
              <div className="prompt-suggestions">
                <span className="suggestion-label">Quick Suggestions:</span>
                <button 
                  className="suggestion-chip"
                  onClick={() => setCustomPrompt('1) Non-Technical Employee Self-Help Walkthrough, 2) Tier-1 Help Desk Fast Resolution Script, 3) Executive Incident Summary.')}
                >
                  Help Desk & User Pair
                </button>
                <button 
                  className="suggestion-chip"
                  onClick={() => setCustomPrompt('1) Plain English Onboarding Step-by-Step, 2) Key Shortcuts & Quick Reference Card, 3) Security & Password Best Practices.')}
                >
                  Onboarding & Security
                </button>
                <button 
                  className="suggestion-chip"
                  onClick={() => setCustomPrompt('1) Mobile / Tablet Field Technician Card, 2) Emergency Outage Quick-Action Protocol, 3) Post-Incident Customer Notice.')}
                >
                  Field & Customer Notice
                </button>
              </div>
            </div>
          )}

          {/* Generate Button Row */}
          <div className="generate-action-row">
            <button
              className="generate-variants-btn"
              onClick={handleGenerateVariants}
              disabled={isGenerating || !focusedArtifact}
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={16} className="spin-icon" /> Generating Variations...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Generate 3 Document Variations
                </>
              )}
            </button>
            {appliedVariantName && (
              <div className="applied-feedback">
                <Check size={16} /> {appliedVariantName}
              </div>
            )}
          </div>

          {/* Generation Progress / Loading */}
          {isGenerating && (
            <div className="variants-generating-state">
              <div className="generating-loader-bar">
                <div className="loader-fill" />
              </div>
              <p className="generating-status-text">{generationProgress || 'Crafting variations...'}</p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="variants-error-box">
              <AlertCircle size={18} />
              <div className="error-text-wrap">
                <strong>Generation Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Generated Variants Grid */}
          {variants.length > 0 && !isGenerating && (
            <div className="generated-variants-section">
              <div className="section-label-row">
                <span className="section-label">Generated Variations</span>
                <span className="section-hint">Click "Apply to Active" or "Add as New" to keep both</span>
              </div>
              <div className="variants-grid-display">
                {variants.map((v, idx) => (
                  <div key={idx} className="variant-display-card">
                    <div className="variant-card-header">
                      <div>
                        <div className="variant-audience-pill">{v.audience || `Variant ${idx + 1}`}</div>
                        <h4 className="variant-title">{v.name}</h4>
                      </div>
                      <button 
                        className="variant-preview-btn"
                        onClick={() => setPreviewVariant(v)}
                        title="Expand Full Preview"
                      >
                        <Maximize2 size={15} />
                      </button>
                    </div>

                    {v.description && <p className="variant-description">{v.description}</p>}

                    {/* Preview Sandbox */}
                    <div className="variant-preview-frame" onClick={() => setPreviewVariant(v)}>
                      <iframe 
                        srcDoc={v.html} 
                        sandbox="allow-scripts allow-same-origin" 
                        title={v.name}
                      />
                      <div className="preview-overlay-hover">
                        <Eye size={20} /> Click to Inspect
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="variant-card-actions">
                      <button
                        className="variant-apply-btn"
                        onClick={() => handleApply(v)}
                        title="Replace active document with this variant"
                      >
                        <Check size={14} /> Apply to Active
                      </button>
                      <button
                        className="variant-add-btn"
                        onClick={() => handleAddAsNew(v)}
                        title="Add as an additional document tab in this session"
                      >
                        <PlusCircle size={14} /> Add as New Doc
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="variants-modal-footer">
          <span className="footer-tip">
            Pro Tip: You can switch providers in Settings at any time to generate variants via Groq, Mistral, or OpenRouter.
          </span>
          <button className="footer-close-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {/* Lightbox / Fullscreen Preview Modal */}
      {previewVariant && (
        <div className="variant-lightbox-overlay" onClick={() => setPreviewVariant(null)}>
          <div className="variant-lightbox-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox-header">
              <div>
                <span className="lightbox-badge">{previewVariant.audience || 'Document Variant'}</span>
                <h3 className="lightbox-title">{previewVariant.name}</h3>
              </div>
              <div className="lightbox-actions">
                <button 
                  className="lightbox-action-btn primary"
                  onClick={() => {
                    handleApply(previewVariant);
                    setPreviewVariant(null);
                  }}
                >
                  <Check size={14} /> Apply to Document
                </button>
                <button 
                  className="lightbox-action-btn"
                  onClick={() => {
                    handleAddAsNew(previewVariant);
                    setPreviewVariant(null);
                  }}
                >
                  <PlusCircle size={14} /> Add as New Doc
                </button>
                <button className="lightbox-close" onClick={() => setPreviewVariant(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="lightbox-body">
              <iframe 
                srcDoc={previewVariant.html} 
                sandbox="allow-scripts allow-same-origin" 
                title={previewVariant.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VariantsModal;
