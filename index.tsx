/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { 
  Artifact, 
  Session, 
  Message, 
  ComponentVariation, 
  AIProvider, 
  GenerationParams, 
  FileAttachment, 
  ProviderSyncState,
  ModelInfo,
  AffectiveTelemetry
} from './types';
import { 
  INITIAL_PLACEHOLDERS, 
  KB_EDIT_SYSTEM_INSTRUCTION, 
  DOC_TEMPLATES, 
  TEMPLATE_REGISTRY 
} from './constants';
import { generateId, convertToMarkdown } from './utils';
import { exportToDocx } from './utils/docExport';
import { 
  loadAffectiveTelemetry, 
  saveAffectiveTelemetry, 
  appendAffectiveContext,
  getAffectivePromptDirective
} from './utils/affectiveTelemetry';
import { 
  loadModelCache, 
  saveModelCache, 
  loadGenerationParams, 
  saveGenerationParams, 
  fetchSecretsStatus, 
  streamGeneration, 
  nonStreamGeneration 
} from './services/aiService';
import { PROVIDER_CONFIGS } from './adapters';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import SettingsModal from './components/SettingsModal';
import VariantsModal from './components/VariantsModal';
import ModelSelector from './components/ModelSelector';
import AffectiveTuningPanel from './components/AffectiveTuningPanel';
import LivePromptPreview from './components/LivePromptPreview';
import { 
  CodeIcon, 
  SparklesIcon, 
  ArrowUpIcon, 
  GridIcon,
  PdfIcon,
  MarkdownIcon,
  FileTextIcon
} from './components/Icons';
import { 
  Settings, 
  Sliders, 
  RotateCcw, 
  PlusCircle, 
  Check, 
  Edit3, 
  FileCode, 
  Paperclip, 
  X, 
  ChevronDown, 
  Layers, 
  FileCheck2,
  Sparkles,
  Users,
  HelpCircle,
  Compass,
  Zap,
  ShieldAlert,
  BookOpen
} from 'lucide-react';

const cleanHtml = (raw: string): string => {
  if (!raw || !raw.trim()) return "";
  let cleaned = raw.replace(/```html/gi, '').replace(/```/g, '').trim();
  const docTypeRegex = /<!DOCTYPE html>/i;
  const matches = Array.from(cleaned.matchAll(new RegExp(docTypeRegex, 'gi')));
  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    if (lastMatch.index !== undefined) {
      return cleaned.substring(lastMatch.index).trim();
    }
  }
  const firstTagIndex = cleaned.indexOf('<');
  if (firstTagIndex !== -1) {
    return cleaned.substring(firstTagIndex).trim();
  }
  return `<div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937; line-height: 1.6;">${cleaned.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>')}</div>`;
};

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

const ChatLog = ({ messages, onUndo, canUndo }: { messages: Message[], onUndo: () => void, canUndo: boolean }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-log">
      {messages.map((msg) => (
        <div key={msg.id} className={`chat-message ${msg.role}`}>
          <div className="chat-bubble">
            <div className="chat-role">{msg.role === 'user' ? 'Engineering' : 'The Scribe'}</div>
            <div className="chat-content">
              {msg.parts.map((part, i) => (
                <div key={i}>{part.text}</div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
      {canUndo && (
        <div className="undo-action-area">
          <button className="undo-button" onClick={onUndo}>
            <RotateCcw size={12} /> Undo Last AI Change
          </button>
        </div>
      )}
    </div>
  );
};

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [placeholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  const [placeholderIndex] = useState(0);
  const [isResetConfirming, setIsResetConfirming] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Multi-Provider State
  const [activeProvider, setActiveProvider] = useState<AIProvider>('gemini');
  const [activeModel, setActiveModel] = useState<string>('gemini-2.5-flash');
  const [modelCache, setModelCache] = useState<Record<AIProvider, ProviderSyncState>>(loadModelCache);
  const [genParams, setGenParams] = useState<GenerationParams>(loadGenerationParams);
  const [secretsStatus, setSecretsStatus] = useState<Record<AIProvider, { hasServerKey: boolean; isBaseUrl?: boolean }>>({
    gemini: { hasServerKey: false },
    openrouter: { hasServerKey: false },
    mistral: { hasServerKey: false },
    groq: { hasServerKey: false },
    huggingface: { hasServerKey: false },
    ollama: { hasServerKey: true, isBaseUrl: true }
  });
  const [customKeys, setCustomKeys] = useState<Record<AIProvider, string>>({
    gemini: '',
    openrouter: '',
    mistral: '',
    groq: '',
    huggingface: '',
    ollama: 'http://localhost:11434'
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isVariantsModalOpen, setIsVariantsModalOpen] = useState<boolean>(false);
  const [templateFilter, setTemplateFilter] = useState<'all' | 'user' | 'technical'>('all');
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [variantFlavor, setVariantFlavor] = useState('Standard Audiences');
  const [drawerState, setDrawerState] = useState<{ 
    isOpen: boolean; 
    mode: 'code' | 'variants' | 'templates' | null; 
    title: string; 
    data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });
  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<string>('');

  // Affective Telemetry Console State
  const [affectiveTelemetry, setAffectiveTelemetry] = useState<AffectiveTelemetry>(loadAffectiveTelemetry);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'affective' | 'history' | 'preview'>('affective');

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Persist Affective Telemetry state
  useEffect(() => {
    const activeDocId = currentSessionIndex >= 0 && sessions[currentSessionIndex] && focusedArtifactIndex !== null
      ? sessions[currentSessionIndex].artifacts[focusedArtifactIndex]?.id
      : undefined;
    saveAffectiveTelemetry(affectiveTelemetry, activeDocId);
  }, [affectiveTelemetry, currentSessionIndex, sessions, focusedArtifactIndex]);

  // Fetch secrets status on mount
  useEffect(() => {
    fetchSecretsStatus().then(status => {
      setSecretsStatus(status);
    });
  }, []);

  // Save modelCache and genParams to localStorage
  useEffect(() => {
    saveModelCache(modelCache);
  }, [modelCache]);

  useEffect(() => {
    saveGenerationParams(genParams);
  }, [genParams]);

  // When active provider changes, ensure activeModel matches available models in synced cache
  useEffect(() => {
    const currentModels = modelCache[activeProvider]?.models || [];
    if (currentModels.length > 0) {
      if (!currentModels.some(m => m.id === activeModel)) {
        setActiveModel(currentModels[0].id);
      }
    } else {
      setActiveModel('');
    }
  }, [activeProvider, modelCache]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const fileList = Array.from(files) as File[];
    for (const file of fileList) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        const base64 = result.split(',')[1];
        setAttachments(prev => [
          ...prev, 
          { id: generateId(), file, name: file.name, base64, mimeType: file.type || 'application/octet-stream' }
        ]);
      };
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleReset = () => {
    setSessions([]);
    setCurrentSessionIndex(-1);
    setFocusedArtifactIndex(null);
    setAttachments([]);
    setInputValue('');
    setIsEditing(false);
    setIsResetConfirming(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleArtifactUpdate = useCallback((newHtml: string, sessionId: string, artifactId: string) => {
    setSessions(prev => prev.map(session => 
      session.id === sessionId ? {
        ...session,
        artifacts: session.artifacts.map(art => 
          art.id === artifactId ? { ...art, html: newHtml } : art
        )
      } : session
    ));
  }, []);

  const handleUndo = useCallback(() => {
    if (currentSessionIndex <= 0 || isLoading) return;
    const newIndex = currentSessionIndex - 1;
    setSessions(prev => prev.slice(0, currentSessionIndex));
    setCurrentSessionIndex(newIndex);
  }, [currentSessionIndex, isLoading]);

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];
    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variants', title: 'Document Variants', data: currentArtifact.id });

    try {
      const apiKey = customKeys[activeProvider];
      const flavorPrompt = variantFlavor === 'Standard Audiences' 
        ? 'Executive Briefing, Detailed Technical Spec, User-Friendly QuickStart' 
        : variantFlavor === 'Regional detours' 
        ? 'HQ Operations, Remote / Field Deployment, Datacenter On-Call' 
        : 'Regulatory Compliance, High-Security Hardening, General IT Support';

      const promptText = `Generate 3 distinct variations of this technical document tailored for different audiences (${flavorPrompt}). 
Original Topic: "${currentSession.prompt}".
Original Document HTML:
${currentArtifact.html}

Output a strictly valid JSON array of objects with the exact schema:
[
  { "name": "Variant Name", "html": "<!DOCTYPE html><html>...</html>" }
]
Only return the JSON array without commentary.`;

      const result = await nonStreamGeneration(
        activeProvider,
        activeModel,
        { user: promptText, schema: undefined },
        genParams,
        apiKey
      );

      if (result.object && Array.isArray(result.object)) {
        setComponentVariations(result.object);
      } else {
        const cleaned = cleanHtml(result.text || '');
        const jsonMatch = result.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsed)) {
              setComponentVariations(parsed);
            }
          } catch {
            // Ignore
          }
        }
      }
    } catch (e: any) {
      console.error("Error generating variants:", e);
      setDrawerState(prev => ({ ...prev, data: `Error: ${e.message}` }));
    } finally {
      setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, activeProvider, activeModel, customKeys, genParams, variantFlavor]);

  const handleApplyVariant = (html: string, variantName: string) => {
    if (currentSessionIndex === -1) return;
    const session = sessions[currentSessionIndex];
    const targetIndex = focusedArtifactIndex !== null ? focusedArtifactIndex : 0;
    if (!session.artifacts[targetIndex]) return;
    const artifactId = session.artifacts[targetIndex].id;
    handleArtifactUpdate(html, session.id, artifactId);
    if (variantName) {
      setSessions(prev => prev.map(s => 
        s.id === session.id 
          ? {
              ...s,
              artifacts: s.artifacts.map(a => a.id === artifactId ? { ...a, styleName: variantName } : a)
            }
          : s
      ));
    }
  };

  const handleAddVariantAsNew = (html: string, title: string) => {
    if (currentSessionIndex === -1) return;
    const session = sessions[currentSessionIndex];
    const newArtifact: Artifact = {
      id: `${session.id}_var_${Date.now()}`,
      styleName: title || 'Adapted Variant',
      html: html,
      status: 'complete',
      provider: activeProvider,
      modelId: activeModel
    };
    setSessions(prev => prev.map(s => 
      s.id === session.id 
        ? { ...s, artifacts: [...s.artifacts, newArtifact] }
        : s
    ));
    setFocusedArtifactIndex(session.artifacts.length);
  };

  const applyVariation = (html: string) => {
    if (focusedArtifactIndex === null || currentSessionIndex === -1) return;
    const session = sessions[currentSessionIndex];
    const artifactId = session.artifacts[focusedArtifactIndex].id;
    handleArtifactUpdate(html, session.id, artifactId);
    setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleExport = (format: 'pdf' | 'md' | 'txt' | 'docx' | 'html') => {
    const currentSession = currentSessionIndex >= 0 ? sessions[currentSessionIndex] : null;
    if (!currentSession || focusedArtifactIndex === null) return;
    const artifact = currentSession.artifacts[focusedArtifactIndex];
    const fileName = `${artifact.styleName.replace(/\s+/g, '_')}_${Date.now()}`;

    if (format === 'pdf') {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.styleName}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; } ${artifact.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''}</style></head><body>${artifact.html.replace(/<style>[\s\S]*?<\/style>/, '')}<script>window.onload = () => setTimeout(() => { try { window.print(); } catch(e) {} }, 500);</script></body></html>`;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    } else if (format === 'docx') {
      exportToDocx(artifact.html, artifact.styleName);
    } else if (format === 'html') {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${artifact.styleName}</title><style>body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #111; line-height: 1.6; } ${artifact.html.match(/<style>([\s\S]*?)<\/style>/)?.[1] || ''}</style></head><body>${artifact.html.replace(/<style>[\s\S]*?<\/style>/, '')}</body></html>`;
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.html`;
      link.click();
    } else {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = artifact.html;
      tempDiv.querySelector('style')?.remove();
      const content = format === 'md' ? convertToMarkdown(artifact.html) : (tempDiv.innerText || tempDiv.textContent || '');
      const blob = new Blob([content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.${format === 'md' ? 'md' : 'txt'}`;
      link.click();
    }
    setIsExportMenuOpen(false);
  };

  const buildContext = (session: Session | null, focusedArtifact?: Artifact, trimmedInput?: string) => {
    const historicalAttachments: FileAttachment[] = [];
    const seenAttachmentIds = new Set<string>();
    
    sessions.forEach(sess => {
      if (sess.attachments) {
        sess.attachments.forEach(att => {
          if (!seenAttachmentIds.has(att.id)) {
            historicalAttachments.push(att);
            seenAttachmentIds.add(att.id);
          }
        });
      }
    });

    const userParts: any[] = [{ text: trimmedInput || "Turn context" }];
    attachments.forEach(att => {
      if (!seenAttachmentIds.has(att.id)) {
        historicalAttachments.push(att);
        seenAttachmentIds.add(att.id);
      }
      userParts.push({ inlineData: { data: att.base64, mimeType: att.mimeType } });
    });

    if (focusedArtifact) {
      userParts.push({ text: `
[CURRENT DOCUMENT STATE]
${focusedArtifact.html}

[TARGETED REFINEMENT TASK]
Goal: "${trimmedInput}". 
Process the update while maintaining the SCRIBE persona and styling.
Output the COMPLETE updated HTML document starting with <!DOCTYPE html>.
      ` });
    }

    const contents = session ? session.messages.map(m => ({ role: m.role, parts: m.parts })) : [];
    contents.push({ role: 'user', parts: userParts });

    return { contents, historicalAttachments, userParts };
  };

  const handleTargetedEdit = async (trimmedInput: string) => {
    const lastSession = sessions[currentSessionIndex];
    if (!lastSession || focusedArtifactIndex === null) return;
    const targetArtifact = lastSession.artifacts[focusedArtifactIndex];

    const sessionId = generateId();
    const newArtifacts: Artifact[] = lastSession.artifacts.map((art, i) => 
      i === focusedArtifactIndex ? { ...art, id: `${sessionId}_${i}`, status: 'streaming' as const } : { ...art, id: `${sessionId}_${i}` }
    );

    const { contents, userParts } = buildContext(lastSession, targetArtifact, trimmedInput);
    const newUserMessage: Message = { id: generateId(), role: 'user', parts: userParts, timestamp: Date.now() };
    const newSession: Session = { 
      ...lastSession, 
      id: sessionId, 
      artifacts: newArtifacts, 
      messages: [...lastSession.messages, newUserMessage], 
      activeArtifactId: newArtifacts[focusedArtifactIndex].id 
    };

    setAttachments([]);
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);

    const apiKey = customKeys[activeProvider];
    let accumulated = '';

    try {
      await streamGeneration(
        activeProvider,
        activeModel,
        {
          system: appendAffectiveContext(KB_EDIT_SYSTEM_INSTRUCTION, affectiveTelemetry),
          user: userParts
        },
        genParams,
        apiKey,
        (chunk) => {
          accumulated += chunk;
          const processedHtml = cleanHtml(accumulated);
          setSessions(prev => prev.map(sess => 
            sess.id === sessionId 
              ? { ...sess, artifacts: sess.artifacts.map(a => a.id === newArtifacts[focusedArtifactIndex].id ? { ...a, html: processedHtml } : a) } 
              : sess
          ));
        }
      );

      const finalHtml = cleanHtml(accumulated);
      const finalModelMessage: Message = { id: generateId(), role: 'model', parts: [{ text: "Document updated." }], timestamp: Date.now() };
      setSessions(prev => prev.map(sess => 
        sess.id === sessionId 
          ? { 
              ...sess, 
              messages: [...sess.messages, finalModelMessage], 
              artifacts: sess.artifacts.map(a => a.id === newArtifacts[focusedArtifactIndex].id ? { ...a, status: 'complete' as const, html: finalHtml } : a) 
            } 
          : sess
      ));
    } catch (e: any) {
      setSessions(prev => prev.map(sess => 
        sess.id === sessionId 
          ? { ...sess, artifacts: sess.artifacts.map(a => a.id === newArtifacts[focusedArtifactIndex].id ? { ...a, status: 'error' as const, error: e.message, provider: activeProvider, modelId: activeModel, html: `<p>Error: ${e.message}</p>` } : a) } 
          : sess
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyAffectiveTuning = async (options: {
    scope: 'selection' | 'document' | 'all';
    targetArtifact?: Artifact;
    selectedText?: string;
    telemetryOverride?: AffectiveTelemetry;
  }) => {
    if (isLoading) return;
    const activeSession = sessions[currentSessionIndex];
    if (!activeSession) return;

    const telemetryToApply = options.telemetryOverride || affectiveTelemetry;
    if (!telemetryToApply.enabled) return;

    setIsLoading(true);

    const directive = getAffectivePromptDirective(telemetryToApply);

    if (options.scope === 'selection') {
      // Partial tuning: rewrite selected text/element with current affective tone
      if (focusedArtifactIndex === null || !options.selectedText) {
        setIsLoading(false);
        return;
      }
      const targetArtifact = activeSession.artifacts[focusedArtifactIndex];
      const refinementPrompt = `Please restyle and rewrite ONLY the following selected excerpt to conform precisely to the affective telemetry directives below, while preserving the exact technical facts, terms, code blocks, and context:\n\n[SELECTED EXCERPT TO TUNE]:\n"""\n${options.selectedText}\n"""\n\n${directive}\n\nUpdate the document accordingly and return the COMPLETE updated HTML document starting with <!DOCTYPE html>.`;
      
      setIsLoading(false);
      await handleTargetedEdit(refinementPrompt);
      return;
    }

    if (options.scope === 'document') {
      // Tune single document
      const target = options.targetArtifact || (focusedArtifactIndex !== null ? activeSession.artifacts[focusedArtifactIndex] : null);
      if (!target) {
        setIsLoading(false);
        return;
      }
      const targetIndex = activeSession.artifacts.findIndex(a => a.id === target.id);
      if (targetIndex === -1) {
        setIsLoading(false);
        return;
      }

      const sessionId = generateId();
      const newArtifacts: Artifact[] = activeSession.artifacts.map((art, i) => 
        i === targetIndex ? { ...art, id: `${sessionId}_${i}`, status: 'streaming' as const } : { ...art, id: `${sessionId}_${i}` }
      );

      const documentTunePrompt = `Apply the following Affective Telemetry tuning to the entire document while keeping all technical accuracy, architecture diagrams, command syntax, and structure intact:\n\n${directive}\n\nOutput the COMPLETE updated HTML document starting with <!DOCTYPE html>.`;

      const { userParts } = buildContext(activeSession, target, documentTunePrompt);
      const newUserMessage: Message = { 
        id: generateId(), 
        role: 'user', 
        parts: [{ text: `Applied Affective Tuning (${telemetryToApply.activePreset || 'Custom'}) to ${target.styleName}` }], 
        timestamp: Date.now() 
      };

      const newSession: Session = { 
        ...activeSession, 
        id: sessionId, 
        artifacts: newArtifacts, 
        messages: [...activeSession.messages, newUserMessage], 
        activeArtifactId: newArtifacts[targetIndex].id 
      };

      setSessions(prev => [...prev, newSession]);
      setCurrentSessionIndex(sessions.length);

      const apiKey = customKeys[activeProvider];
      let accumulated = '';

      try {
        await streamGeneration(
          activeProvider,
          activeModel,
          {
            system: appendAffectiveContext(KB_EDIT_SYSTEM_INSTRUCTION, telemetryToApply),
            user: userParts
          },
          genParams,
          apiKey,
          (chunk) => {
            accumulated += chunk;
            const processedHtml = cleanHtml(accumulated);
            setSessions(prev => prev.map(sess => 
              sess.id === sessionId 
                ? { ...sess, artifacts: sess.artifacts.map(a => a.id === newArtifacts[targetIndex].id ? { ...a, html: processedHtml } : a) } 
                : sess
            ));
          }
        );

        const finalHtml = cleanHtml(accumulated);
        const finalModelMessage: Message = { 
          id: generateId(), 
          role: 'model', 
          parts: [{ text: `Document "${target.styleName}" updated with affective tuning coordinates.` }], 
          timestamp: Date.now() 
        };

        setSessions(prev => prev.map(sess => 
          sess.id === sessionId 
            ? { 
                ...sess, 
                messages: [...sess.messages, finalModelMessage], 
                artifacts: sess.artifacts.map(a => a.id === newArtifacts[targetIndex].id ? { ...a, status: 'complete' as const, html: finalHtml } : a) 
              } 
            : sess
        ));
      } catch (e: any) {
        setSessions(prev => prev.map(sess => 
          sess.id === sessionId 
            ? { ...sess, artifacts: sess.artifacts.map(a => a.id === newArtifacts[targetIndex].id ? { ...a, status: 'error' as const, error: e.message, provider: activeProvider, modelId: activeModel, html: `<p>Error: ${e.message}</p>` } : a) } 
            : sess
        ));
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (options.scope === 'all') {
      // Tune all documents in the session simultaneously
      const sessionId = generateId();
      const newArtifacts: Artifact[] = activeSession.artifacts.map((art, i) => ({
        ...art,
        id: `${sessionId}_${i}`,
        status: 'streaming' as const
      }));

      const newSession: Session = {
        ...activeSession,
        id: sessionId,
        artifacts: newArtifacts,
        messages: [
          ...activeSession.messages,
          {
            id: generateId(),
            role: 'user',
            parts: [{ text: `Applied Affective Tuning (${telemetryToApply.activePreset || 'Custom'}) across all documents in workspace.` }],
            timestamp: Date.now()
          }
        ]
      };

      setSessions(prev => [...prev, newSession]);
      setCurrentSessionIndex(sessions.length);

      const apiKey = customKeys[activeProvider];

      await Promise.all(activeSession.artifacts.map(async (artifact, i) => {
        await wait(i * 200);
        let accumulated = '';
        const docTunePrompt = `Apply the following Affective Telemetry tuning to the entire document while keeping all technical accuracy, markdown formatting, and design intact:\n\n${directive}\n\nOutput the COMPLETE updated HTML document starting with <!DOCTYPE html>.`;
        const { userParts } = buildContext(activeSession, artifact, docTunePrompt);

        try {
          await streamGeneration(
            activeProvider,
            activeModel,
            {
              system: appendAffectiveContext(KB_EDIT_SYSTEM_INSTRUCTION, telemetryToApply),
              user: userParts
            },
            genParams,
            apiKey,
            (chunk) => {
              accumulated += chunk;
              const processedHtml = cleanHtml(accumulated);
              setSessions(prev => prev.map(sess => 
                sess.id === sessionId 
                  ? { ...sess, artifacts: sess.artifacts.map(a => a.id === newArtifacts[i].id ? { ...a, html: processedHtml } : a) } 
                  : sess
              ));
            }
          );

          const finalCleaned = cleanHtml(accumulated);
          setSessions(prev => prev.map(sess => 
            sess.id === sessionId 
              ? { ...sess, artifacts: sess.artifacts.map(a => a.id === newArtifacts[i].id ? { ...a, status: 'complete' as const, html: finalCleaned } : a) } 
              : sess
          ));
        } catch (e: any) {
          setSessions(prev => prev.map(sess => 
            sess.id === sessionId 
              ? { ...sess, artifacts: sess.artifacts.map(a => a.id === newArtifacts[i].id ? { ...a, status: 'error', error: e.message, provider: activeProvider, modelId: activeModel, html: `<p>Error: ${e.message}</p>` } : a) } 
              : sess
          ));
        }
      }));

      setIsLoading(false);
    }
  };

  const handleRetryArtifact = async (
    artifactToRetry: Artifact,
    providerOverride?: AIProvider,
    modelOverride?: string
  ) => {
    if (isLoading) return;
    setIsLoading(true);

    const activeSession = sessions[currentSessionIndex];
    if (!activeSession) {
      setIsLoading(false);
      return;
    }

    const providerToUse = providerOverride || activeProvider;
    const modelToUse = modelOverride || activeModel || (modelCache[providerToUse]?.models?.[0]?.id ?? 'gemini-2.5-flash');

    const template = Object.values(TEMPLATE_REGISTRY).find(t => t.label === artifactToRetry.styleName) || Object.values(TEMPLATE_REGISTRY)[0];
    const instruction = template.instruction;

    setSessions(prev => prev.map(sess => 
      sess.id === activeSession.id
        ? {
            ...sess,
            artifacts: sess.artifacts.map(a => 
              a.id === artifactToRetry.id 
                ? { ...a, status: 'streaming' as const, error: undefined, provider: providerToUse, modelId: modelToUse } 
                : a
            )
          }
        : sess
    ));

    const apiKey = customKeys[providerToUse];
    const { userParts } = buildContext(activeSession, undefined, activeSession.prompt);

    let accumulated = '';
    try {
      await streamGeneration(
        providerToUse,
        modelToUse,
        {
          system: appendAffectiveContext(instruction, affectiveTelemetry),
          user: userParts
        },
        genParams,
        apiKey,
        (chunk) => {
          accumulated += chunk;
          const processedHtml = cleanHtml(accumulated);
          setSessions(prev => prev.map(sess => 
            sess.id === activeSession.id 
              ? { ...sess, artifacts: sess.artifacts.map(a => a.id === artifactToRetry.id ? { ...a, html: processedHtml } : a) } 
              : sess
          ));
        }
      );
      const finalCleaned = cleanHtml(accumulated);
      setSessions(prev => prev.map(sess => 
        sess.id === activeSession.id 
          ? { ...sess, artifacts: sess.artifacts.map(a => a.id === artifactToRetry.id ? { ...a, status: 'complete' as const, html: finalCleaned, error: undefined } : a) } 
          : sess
      ));
    } catch (e: any) {
      setSessions(prev => prev.map(sess => 
        sess.id === activeSession.id 
          ? { 
              ...sess, 
              artifacts: sess.artifacts.map(a => 
                a.id === artifactToRetry.id 
                  ? { ...a, status: 'error' as const, error: e.message, provider: providerToUse, modelId: modelToUse, html: `<p>Error: ${e.message}</p>` } 
                  : a
              ) 
            } 
          : sess
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchToGemini = (artifactToRetry?: Artifact) => {
    setActiveProvider('gemini');
    setActiveModel('gemini-2.5-flash');
    if (artifactToRetry) {
      handleRetryArtifact(artifactToRetry, 'gemini', 'gemini-2.5-flash');
    } else if (currentSessionIndex >= 0 && sessions[currentSessionIndex]) {
      const failed = sessions[currentSessionIndex].artifacts.find(a => a.status === 'error');
      if (failed) {
        handleRetryArtifact(failed, 'gemini', 'gemini-2.5-flash');
      }
    }
  };

  const handleAddArtifact = async (templateId: string) => {
    const lastSession = currentSessionIndex >= 0 ? sessions[currentSessionIndex] : null;
    if (!lastSession) return;
    
    setDrawerState({ isOpen: false, mode: null, title: '', data: null });
    setIsLoading(true);

    const templateData = templateId === 'all' ? null : (TEMPLATE_REGISTRY as any)[templateId];
    const stylesToGenerate = templateData ? [templateData.label] : Object.values(TEMPLATE_REGISTRY).map(t => t.label);
    const instructionsToUse = templateData ? [templateData.instruction] : Object.values(TEMPLATE_REGISTRY).map(t => t.instruction);
    
    const sessionId = generateId();
    const newArtifactPlaceholders: Artifact[] = stylesToGenerate.map((style, i) => ({
      id: `${sessionId}_add_${i}`, 
      styleName: style, 
      html: '', 
      status: 'streaming',
      provider: activeProvider,
      modelId: activeModel
    }));

    const updatedArtifacts = [...lastSession.artifacts, ...newArtifactPlaceholders];
    
    const existingDocsContext = lastSession.artifacts
      .filter(a => a.status === 'complete')
      .map(a => `[ESTABLISHED DOCUMENT: ${a.styleName}]\n${a.html}`)
      .join('\n\n');

    const expansionPrompt = `
You have already generated technical documentation for this system:
${existingDocsContext}

Now, generate the following additional artifact(s): ${stylesToGenerate.join(', ')}.
Ensure the new content is technically consistent with the existing documentation provided above.
Output complete standard HTML starting with <!DOCTYPE html>.
`;

    const { userParts } = buildContext(lastSession, undefined, expansionPrompt);
    
    const newSession: Session = {
      ...lastSession,
      id: sessionId,
      artifacts: updatedArtifacts,
      messages: [
        ...lastSession.messages, 
        { id: generateId(), role: 'user', parts: [{ text: `Generate additional document: ${stylesToGenerate.join(', ')}` }], timestamp: Date.now() }
      ]
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);

    const apiKey = customKeys[activeProvider];

    await Promise.all(newArtifactPlaceholders.map(async (art, i) => {
      await wait(i * 300);
      let accumulated = '';
      const instruction = instructionsToUse[i];
      try {
        await streamGeneration(
          activeProvider,
          activeModel,
          {
            system: appendAffectiveContext(instruction, affectiveTelemetry),
            user: userParts
          },
          genParams,
          apiKey,
          (chunk) => {
            accumulated += chunk;
            const processedHtml = cleanHtml(accumulated);
            setSessions(prev => prev.map(sess => 
              sess.id === sessionId 
                ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, html: processedHtml } : a) } 
                : sess
            ));
          }
        );
        const finalCleaned = cleanHtml(accumulated);
        setSessions(prev => prev.map(sess => 
          sess.id === sessionId 
            ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'complete' as const, html: finalCleaned } : a) } 
            : sess
        ));
      } catch (e: any) {
        setSessions(prev => prev.map(sess => 
          sess.id === sessionId 
            ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'error', error: e.message, provider: activeProvider, modelId: activeModel, html: `<p>Error: ${e.message}</p>` } : a) } 
            : sess
        ));
      }
    }));

    setIsLoading(false);
  };

  const handleGeneration = async (trimmedInput: string, templateId: string = 'all') => {
    const sessionId = generateId();
    const templateData = templateId === 'all' ? null : (TEMPLATE_REGISTRY as any)[templateId];
    
    const styles = templateData ? [templateData.label] : Object.values(TEMPLATE_REGISTRY).map(t => t.label);
    const instructions = templateData ? [templateData.instruction] : Object.values(TEMPLATE_REGISTRY).map(t => t.instruction);

    const placeholderArtifacts: Artifact[] = styles.map((style, i) => ({
      id: `${sessionId}_${i}`, 
      styleName: style, 
      html: '', 
      status: 'streaming',
      provider: activeProvider,
      modelId: activeModel
    }));
    
    const { userParts } = buildContext(null, undefined, trimmedInput);
    const newUserMessage: Message = { id: generateId(), role: 'user', parts: userParts, timestamp: Date.now() };

    const newSession: Session = {
      id: sessionId,
      prompt: trimmedInput || "Batch Documentation",
      timestamp: Date.now(),
      artifacts: placeholderArtifacts,
      messages: [newUserMessage],
      attachments: [...attachments]
    };

    setAttachments([]);
    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);
    const apiKey = customKeys[activeProvider];

    try {
      await Promise.all(placeholderArtifacts.map(async (art, i) => {
        await wait(i * 300);
        let accumulated = '';
        try {
          await streamGeneration(
            activeProvider,
            activeModel,
            {
              system: appendAffectiveContext(instructions[i], affectiveTelemetry),
              user: userParts
            },
            genParams,
            apiKey,
            (chunk) => {
              accumulated += chunk;
              const processedHtml = cleanHtml(accumulated);
              setSessions(prev => prev.map(sess => 
                sess.id === sessionId 
                  ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, html: processedHtml } : a) } 
                  : sess
              ));
            }
          );
          const finalCleaned = cleanHtml(accumulated);
          setSessions(prev => prev.map(sess => 
            sess.id === sessionId 
              ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'complete' as const, html: finalCleaned, error: undefined } : a) } 
              : sess
          ));
        } catch (e: any) {
          setSessions(prev => prev.map(sess => 
            sess.id === sessionId 
              ? { ...sess, artifacts: sess.artifacts.map(a => a.id === art.id ? { ...a, status: 'error', error: e.message, provider: activeProvider, modelId: activeModel, html: `<p>Error: ${e.message}</p>` } : a) } 
              : sess
          ));
        }
      }));

      const finalModelMessage: Message = { id: generateId(), role: 'model', parts: [{ text: "Documentation generated successfully." }], timestamp: Date.now() };
      setSessions(prev => prev.map(sess => sess.id === sessionId ? { ...sess, messages: [...sess.messages, finalModelMessage] } : sess));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    if (!trimmedInput && attachments.length === 0) return;
    if (isLoading) return;

    if (focusedArtifactIndex !== null) {
      setIsLoading(true);
      handleTargetedEdit(trimmedInput);
      setInputValue('');
    } else {
      setPendingPrompt(trimmedInput);
      setDrawerState({ isOpen: true, mode: 'templates', title: 'Select Document Template', data: null });
      setInputValue('');
    }
  }, [inputValue, isLoading, focusedArtifactIndex, attachments]);

  const onSelectTemplate = (id: string) => {
    const mode = drawerState.data;
    setDrawerState({ isOpen: false, mode: null, title: '', data: null });
    setIsLoading(true);
    
    if (mode === 'expansion') {
      handleAddArtifact(id);
    } else {
      handleGeneration(pendingPrompt, id);
      setPendingPrompt('');
    }
  };

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = currentSessionIndex >= 0 ? sessions[currentSessionIndex] : null;
  const currentProviderModels = modelCache[activeProvider]?.models || [];
  const isProviderConfigured = secretsStatus[activeProvider]?.hasServerKey || Boolean(customKeys[activeProvider]) || activeProvider === 'gemini' || activeProvider === 'ollama';

  return (
    <>
      {/* Top Application Header */}
      <header className="app-top-header">
        <div className="header-left">
          <a href="#" className="brand-logo-link" onClick={(e) => { e.preventDefault(); handleReset(); }}>
            <div className="brand-icon-box">
              <FileCheck2 size={20} />
            </div>
            <div className="brand-title-wrap">
              <span className="brand-title">SupportDocs AI</span>
              <span className="brand-tagline">Multi-Provider IT Documentation</span>
            </div>
          </a>
        </div>

        <div className="header-center">
          {/* Provider Selection pill */}
          <button 
            type="button" 
            className="provider-switch-pill"
            onClick={() => setIsSettingsOpen(true)}
            title="Configure AI Provider & Secrets"
          >
            <span className={`provider-status-dot ${isProviderConfigured ? 'ready' : 'unconfigured'}`} />
            <span>{PROVIDER_CONFIGS[activeProvider]?.name || activeProvider}</span>
            <ChevronDown size={13} />
          </button>

          {/* Model Selector synced cache dropdown with capability badges */}
          <ModelSelector
            models={currentProviderModels}
            selectedModelId={activeModel}
            onSelectModel={(modelId) => setActiveModel(modelId)}
            disabled={isLoading}
          />
        </div>

        <div className="header-right">
          {sessions.length > 0 && (
            <div className="reset-container">
              {!isResetConfirming ? (
                <button className="header-action-btn" onClick={() => setIsResetConfirming(true)}>
                  <RotateCcw size={14} />
                  <span>Reset</span>
                </button>
              ) : (
                <div className="confirm-group">
                  <button className="header-action-btn danger" onClick={handleReset}>
                    Confirm Reset
                  </button>
                  <button className="header-action-btn" onClick={() => setIsResetConfirming(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          <button 
            type="button" 
            className="header-action-btn" 
            onClick={() => setIsSettingsOpen(true)}
            title="Provider Configuration & Generation Parameters"
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>
      </header>

      {/* Provider Configuration & Generation Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeProvider={activeProvider}
        onSelectProvider={(p) => setActiveProvider(p)}
        modelCache={modelCache}
        onUpdateModelCache={(cache) => setModelCache(cache)}
        secretsStatus={secretsStatus}
        customKeys={customKeys}
        onUpdateCustomKey={(prov, key) => setCustomKeys(prev => ({ ...prev, [prov]: key }))}
        genParams={genParams}
        onUpdateGenParams={(params) => setGenParams(params)}
      />

      {/* Document Variants & User Documentation Modal */}
      <VariantsModal
        isOpen={isVariantsModalOpen}
        onClose={() => setIsVariantsModalOpen(false)}
        focusedArtifact={
          currentSession && focusedArtifactIndex !== null 
            ? currentSession.artifacts[focusedArtifactIndex] 
            : (currentSession && currentSession.artifacts.length > 0 ? currentSession.artifacts[0] : null)
        }
        sessionPrompt={currentSession?.prompt || ''}
        activeProvider={activeProvider}
        activeModel={activeModel}
        customKeys={customKeys}
        genParams={genParams}
        onApplyVariant={handleApplyVariant}
        onAddAsNewDocument={handleAddVariantAsNew}
        onGenerateDirectTemplate={(templateId) => {
          handleAddArtifact(templateId);
        }}
      />

      {/* Side Drawer for Templates and Code View */}
      <SideDrawer isOpen={drawerState.isOpen} onClose={() => setDrawerState(s => ({...s, isOpen: false}))} title={drawerState.title}>
        {drawerState.mode === 'templates' && (
          <div className="template-picker-container">
            <div className="drawer-template-tabs">
              <button 
                className={`drawer-tab-btn ${templateFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTemplateFilter('all')}
              >
                All ({DOC_TEMPLATES.length})
              </button>
              <button 
                className={`drawer-tab-btn ${templateFilter === 'user' ? 'active' : ''}`}
                onClick={() => setTemplateFilter('user')}
              >
                <Users size={12} /> User Docs ({DOC_TEMPLATES.filter(t => t.category === 'user').length})
              </button>
              <button 
                className={`drawer-tab-btn ${templateFilter === 'technical' ? 'active' : ''}`}
                onClick={() => setTemplateFilter('technical')}
              >
                <FileTextIcon /> Technical ({DOC_TEMPLATES.filter(t => t.category === 'technical').length})
              </button>
            </div>

            <div className="template-picker-grid">
              {DOC_TEMPLATES.filter(t => templateFilter === 'all' ? true : t.category === templateFilter).map(t => (
                <div key={t.id} className="template-card" onClick={() => onSelectTemplate(t.id)}>
                  <div className="template-card-icon">
                    {t.category === 'user' ? <Users size={18} /> : <Sparkles size={18} />}
                  </div>
                  <div className="template-card-content">
                    <div className="template-card-title-row">
                      <h3>{t.name}</h3>
                      <span className={`template-type-badge ${t.category}`}>{t.category === 'user' ? 'User Doc' : 'Technical'}</span>
                    </div>
                    <p>{t.description}</p>
                  </div>
                </div>
              ))}
              {templateFilter === 'all' && (
                <div className="template-card highlight" onClick={() => onSelectTemplate('all')}>
                  <div className="template-card-icon"><GridIcon /></div>
                  <div className="template-card-content">
                    <h3>Full Suite</h3>
                    <p>Generate all 11 document types for comprehensive technical and user coverage.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {drawerState.mode === 'variants' && (
          <div className="sexy-grid">
            <div className="flavor-selection">
              <label>Audience / Detour Style</label>
              <select value={variantFlavor} onChange={(e) => setVariantFlavor(e.target.value)}>
                <option value="Standard Audiences">Standard Audiences (Exec / Tech / User)</option>
                <option value="Regional detours">Regional & Site Detours (HQ / Field / Datacenter)</option>
                <option value="Compliance variants">Compliance, Security & Hardening Variants</option>
              </select>
              <button className="regenerate-variants" onClick={handleGenerateVariations} disabled={isLoading}>
                <Sparkles size={14} /> {isLoading ? 'Refining...' : 'Regenerate'}
              </button>
            </div>
            <div className="variants-list">
              {componentVariations.map((v, i) => (
                <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                  <div className="sexy-preview">
                    <iframe srcDoc={v.html} sandbox="allow-scripts allow-same-origin" title={v.name} />
                  </div>
                  <div className="sexy-label">{v.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {drawerState.mode === 'code' && (
          <pre className="code-block"><code>{drawerState.data}</code></pre>
        )}
      </SideDrawer>

      <div className="immersive-app">
        <DottedGlowBackground gap={24} radius={1.5} speedScale={0.5} />

        <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
          <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
            <div className="empty-content">
              <h1>SupportDocs AI</h1>
              <p>Authoritative enterprise IT documentation and systems knowledge engine. Powered by Gemini, OpenRouter, Mistral, Groq, Hugging Face, and Ollama.</p>
              <button className="surprise-button" onClick={() => handleSendMessage(placeholders[placeholderIndex])}>
                <Sparkles size={16} /> Random IT Scenario
              </button>
            </div>
          </div>

          {sessions.map((session, sIndex) => (
            <div key={session.id} className={`session-group ${sIndex === currentSessionIndex ? 'active-session' : 'past-session'}`}>
              <div className="artifact-grid">
                {session.artifacts.map((artifact, aIndex) => (
                  <ArtifactCard 
                    key={artifact.id} 
                    artifact={artifact} 
                    isFocused={focusedArtifactIndex === aIndex} 
                    isEditing={focusedArtifactIndex === aIndex && isEditing}
                    onUpdate={(html) => handleArtifactUpdate(html, session.id, artifact.id)}
                    onClick={() => setFocusedArtifactIndex(aIndex)}
                    onRetry={() => handleRetryArtifact(artifact)}
                    onSwitchToGemini={() => handleSwitchToGemini(artifact)}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                    affectiveTelemetry={affectiveTelemetry}
                    onApplyAffectiveTuning={handleApplyAffectiveTuning}
                    isApplyingTuning={isLoading}
                  />
                ))}
              </div>
              {focusedArtifactIndex !== null && sIndex === currentSessionIndex && (
                <div className="focus-chat-panel">
                  <div className="focus-sidebar-header-tabs">
                    <button 
                      type="button"
                      className={`focus-sidebar-tab ${activeSidebarTab === 'affective' ? 'active' : ''}`}
                      onClick={() => setActiveSidebarTab('affective')}
                      title="Affective Tuning Console"
                    >
                      <Sliders size={13} /> AFFECTIVE TUNING
                    </button>
                    <button 
                      type="button"
                      className={`focus-sidebar-tab ${activeSidebarTab === 'history' ? 'active' : ''}`}
                      onClick={() => setActiveSidebarTab('history')}
                      title="Conversation History"
                    >
                      <RotateCcw size={13} /> CONVERSATION ({session.messages.length})
                    </button>
                    <button 
                      type="button"
                      className={`focus-sidebar-tab ${activeSidebarTab === 'preview' ? 'active' : ''}`}
                      onClick={() => setActiveSidebarTab('preview')}
                      title="Live Prompt Preview"
                    >
                      <FileCode size={13} /> PROMPT PREVIEW
                    </button>
                  </div>
                  {activeSidebarTab === 'affective' && (
                    <AffectiveTuningPanel 
                      telemetry={affectiveTelemetry}
                      onChange={(newTelemetry) => setAffectiveTelemetry(newTelemetry)}
                      activeDocumentTitle={session.artifacts[focusedArtifactIndex]?.styleName}
                      onApplyToDocument={(tel) => handleApplyAffectiveTuning({ scope: 'document', telemetryOverride: tel })}
                      onApplyToAllDocuments={(tel) => handleApplyAffectiveTuning({ scope: 'all', telemetryOverride: tel })}
                      isApplying={isLoading}
                    />
                  )}
                  {activeSidebarTab === 'history' && (
                    <ChatLog messages={session.messages} onUndo={handleUndo} canUndo={currentSessionIndex > 0} />
                  )}
                  {activeSidebarTab === 'preview' && (
                    <LivePromptPreview 
                      telemetry={affectiveTelemetry}
                      activeDocumentTitle={session.artifacts[focusedArtifactIndex]?.styleName}
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Action Bar */}
        <div className={`action-bar ${currentSession ? 'visible' : ''}`}>
          <div className="active-prompt-label">
            {focusedArtifactIndex !== null 
              ? `Refining: ${currentSession?.artifacts[focusedArtifactIndex]?.styleName}` 
              : `Workspace: ${currentSession?.prompt}`}
          </div>

          {affectiveTelemetry.enabled && (
            <div className="affective-context-pill" title="Active Affective Telemetry Vector">
              <span className="pill-dot" />
              <span>Valence: {affectiveTelemetry.toneAuthority} | Trajectory: {affectiveTelemetry.abstractionLevel}</span>
            </div>
          )}

          <div className="action-buttons-wrapper">
            <div className="action-buttons">
              <div className="btn-group">
                <button 
                  onClick={() => { setFocusedArtifactIndex(null); setIsEditing(false); }} 
                  className={focusedArtifactIndex === null ? 'active' : ''}
                >
                  <GridIcon /> Workspace
                </button>
              </div>
              <div className="btn-group main-actions">
                <button 
                  className="add-doc-btn"
                  onClick={() => setDrawerState({ isOpen: true, mode: 'templates', title: 'Add Document to Session', data: 'expansion' })} 
                  disabled={isLoading}
                  title="Add another document to this workspace"
                >
                  <PlusCircle size={15} /> Add Document
                </button>
                {focusedArtifactIndex !== null ? (
                  <>
                    <button onClick={() => setIsEditing(!isEditing)} className={isEditing ? 'active' : ''} disabled={isLoading}>
                      {isEditing ? <><Check size={14} /> Done</> : <><Edit3 size={14} /> Edit</>}
                    </button>
                    {!isEditing && (
                      <button 
                        onClick={() => setIsVariantsModalOpen(true)} 
                        disabled={isLoading}
                        className="variants-action-btn"
                        title="Open Document Variants & User Documentation Modal"
                      >
                        <Sparkles size={14} /> Variants
                      </button>
                    )}
                    <button onClick={() => setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: currentSession?.artifacts[focusedArtifactIndex]?.html })}>
                      <CodeIcon /> Source
                    </button>
                  </>
                ) : (
                  currentSession && currentSession.artifacts.length > 0 && (
                    <button 
                      onClick={() => setIsVariantsModalOpen(true)} 
                      disabled={isLoading}
                      className="variants-action-btn"
                      title="Open Document Variants & User Documentation Modal"
                    >
                      <Sparkles size={14} /> Variants
                    </button>
                  )
                )}
              </div>
              
              {focusedArtifactIndex !== null && !isEditing && (
                <div className="export-dropdown-container" ref={exportRef}>
                  <button className={`export-trigger ${isExportMenuOpen ? 'active' : ''}`} onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}>
                    Export <ChevronDown size={14} />
                  </button>
                  {isExportMenuOpen && (
                    <div className="export-menu">
                      <button onClick={() => handleExport('docx')}><FileTextIcon /> Word (.docx)</button>
                      <button onClick={() => handleExport('pdf')}><PdfIcon /> PDF Print</button>
                      <button onClick={() => handleExport('html')}><FileCode size={14} /> HTML Document</button>
                      <button onClick={() => handleExport('md')}><MarkdownIcon /> Markdown (.md)</button>
                      <button onClick={() => handleExport('txt')}><FileTextIcon /> Plain Text (.txt)</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Floating Input Container */}
        <div className="floating-input-container">
          <div className="input-outer-wrapper">
            {attachments.length > 0 && (
              <div className="attachment-pills">
                {attachments.map(att => (
                  <div key={att.id} className="attachment-pill">
                    <span className="file-name">{att.name}</span>
                    <button onClick={() => removeAttachment(att.id)} className="remove-att">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                onChange={handleFileChange} 
                multiple 
                accept=".pdf,image/*,.txt,.md,.log" 
              />
              <button 
                className="attachment-trigger" 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isLoading} 
                title="Attach Logs, Screenshots, or Text Context"
              >
                <Paperclip size={18} />
              </button>
              <div className="input-main">
                <input 
                  ref={inputRef} 
                  type="text" 
                  placeholder={
                    focusedArtifactIndex !== null 
                      ? "Request refinements to this document..." 
                      : (sessions.length > 0 ? "Message The Scribe..." : "What system or outage do we need to document today?")
                  } 
                  value={inputValue} 
                  onChange={(e) => setInputValue(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                  disabled={isLoading} 
                />
              </div>
              <button 
                className="send-button" 
                onClick={() => handleSendMessage()} 
                disabled={isLoading || (!inputValue.trim() && attachments.length === 0)}
              >
                <ArrowUpIcon />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}
