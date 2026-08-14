import React, { useRef, useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import { 
    Bold, 
    Italic, 
    Heading1, 
    Heading2, 
    List, 
    ListOrdered,
    Image as ImageIcon,
    SeparatorHorizontal,
    Sliders,
    Sparkles,
    Loader2
} from 'lucide-react';
import { AffectiveTelemetry } from '../types';

interface EditorProps {
    content: string;
    onUpdate: (html: string) => void;
    affectiveTelemetry?: AffectiveTelemetry;
    onApplyAffectiveTuning?: (options: { scope: 'selection' | 'all'; selectedText?: string; selectedHtml?: string }) => Promise<void> | void;
    isApplyingTuning?: boolean;
}

const Editor = ({ content, onUpdate, affectiveTelemetry, onApplyAffectiveTuning, isApplyingTuning = false }: EditorProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const onUpdateRef = useRef(onUpdate);
    const [hasSelection, setHasSelection] = useState(false);

    // Keep the update callback ref fresh to avoid stale closures in Tiptap's listener
    useEffect(() => {
        onUpdateRef.current = onUpdate;
    }, [onUpdate]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                // Disable the default horizontal rule to use our customized one
                horizontalRule: false,
            }),
            HorizontalRule.extend({
                // Story 2, AC1: Pressing Mod-Enter inserts a Page Break
                addKeyboardShortcuts() {
                    return {
                        'Mod-Enter': () => this.editor.commands.setHorizontalRule(),
                    }
                },
            }).configure({
                HTMLAttributes: {
                    class: 'page-break', // Story 4 AC1: Using standard .page-break class
                },
            }),
            Image.configure({
                inline: true,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'max-w-full h-auto rounded-lg border border-gray-200 shadow-sm my-4',
                },
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onUpdateRef.current(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-slate max-w-none focus:outline-none tiptap-content',
            },
        },
    });

    // Synchronize external content changes (e.g., from AI streaming) into the editor
    useEffect(() => {
        if (editor && content !== editor.getHTML()) {
            editor.commands.setContent(content, false);
        }
    }, [content, editor]);

    // Track selection changes to enable partial / selected element affective tuning
    useEffect(() => {
        if (!editor) return;

        const updateSelectionState = () => {
            const { from, to } = editor.state.selection;
            setHasSelection(from !== to);
        };

        editor.on('selectionUpdate', updateSelectionState);
        editor.on('transaction', updateSelectionState);

        return () => {
            editor.off('selectionUpdate', updateSelectionState);
            editor.off('transaction', updateSelectionState);
        };
    }, [editor]);

    if (!editor) {
        return null;
    }

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target?.result as string;
                if (base64) {
                    editor.chain().focus().setImage({ src: base64 }).run();
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Story 2, AC2 & AC3: Toolbar button and automatic focus move
    const insertPageBreak = () => {
        editor.chain().focus().setHorizontalRule().run();
    };

    const handleApplyTuning = (scope: 'selection' | 'all') => {
        if (!onApplyAffectiveTuning) return;
        if (scope === 'selection') {
            const { from, to } = editor.state.selection;
            const selectedText = editor.state.doc.textBetween(from, to, ' ');
            onApplyAffectiveTuning({ scope: 'selection', selectedText });
        } else {
            onApplyAffectiveTuning({ scope: 'all' });
        }
    };

    return (
        <div className="editor-container">
            <div className="editor-toolbar">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    disabled={!editor.can().chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active' : ''}
                    title="Bold"
                >
                    <Bold size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    disabled={!editor.can().chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active' : ''}
                    title="Italic"
                >
                    <Italic size={16} />
                </button>
                <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                    className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
                    title="Heading 1"
                >
                    <Heading1 size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
                    title="Heading 2"
                >
                    <Heading2 size={16} />
                </button>
                <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active' : ''}
                    title="Bullet List"
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'is-active' : ''}
                    title="Ordered List"
                >
                    <ListOrdered size={16} />
                </button>
                <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                <button
                    onClick={insertPageBreak}
                    title="Insert Page Break (Cmd+Enter)"
                >
                    <SeparatorHorizontal size={16} />
                </button>
                <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    title="Insert Image"
                    className="image-upload-btn"
                >
                    <ImageIcon size={16} />
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    accept="image/*" 
                    onChange={handleImageUpload} 
                />

                {/* Affective Tuning Apply Actions in Editor Toolbar */}
                {onApplyAffectiveTuning && (
                    <>
                        <div className="toolbar-divider" style={{ width: '1px', height: '20px', background: '#e4e4e7', margin: '0 4px' }} />
                        <div className="editor-affective-actions">
                            <button
                                type="button"
                                onClick={() => handleApplyTuning('selection')}
                                disabled={!hasSelection || isApplyingTuning || (affectiveTelemetry && !affectiveTelemetry.enabled)}
                                className={`editor-affective-btn ${hasSelection ? 'has-selection' : ''}`}
                                title={
                                    !hasSelection 
                                        ? 'Highlight or select text/elements in the editor to apply affective tuning to selection'
                                        : affectiveTelemetry?.enabled === false
                                        ? 'Affective tuning is bypassed. Activate in tuning panel to apply.'
                                        : 'Apply current affective tuning tone to selected element(s)'
                                }
                            >
                                {isApplyingTuning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                <span className="btn-text">Tune Selection</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleApplyTuning('all')}
                                disabled={isApplyingTuning || (affectiveTelemetry && !affectiveTelemetry.enabled)}
                                className="editor-affective-btn tune-all"
                                title={
                                    affectiveTelemetry?.enabled === false
                                        ? 'Affective tuning is bypassed. Activate in tuning panel to apply.'
                                        : 'Apply current affective tuning tone across the entire document'
                                }
                            >
                                <Sliders size={14} />
                                <span className="btn-text">Tune Entire Doc</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
            <div className="editor-scroll-area">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
};

export default Editor;