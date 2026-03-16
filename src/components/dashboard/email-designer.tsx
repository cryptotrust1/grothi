'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * Sanitize HTML content to prevent XSS in email designer preview.
 * Strips script tags, event handlers, and dangerous protocols.
 */
function sanitizeHtml(html: string): string {
  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript: protocol
    .replace(/href\s*=\s*["']?\s*javascript:/gi, 'href="')
    // Remove data: URIs in src (potential XSS vector)
    .replace(/src\s*=\s*["']?\s*data:text\/html/gi, 'src="')
    // Remove iframe, object, embed tags
    .replace(/<\s*\/?\s*(iframe|object|embed|form|input|textarea)\b[^>]*>/gi, '')
    // Remove style expressions (IE-specific XSS)
    .replace(/expression\s*\(/gi, 'blocked(')
    // Remove -moz-binding
    .replace(/-moz-binding\s*:/gi, 'blocked:');
}
import type {
  EmailDesign,
  EmailSection,
  EmailBlock,
  EmailBlockType,
  EmailGlobalStyles,
  TextBlock,
  HeadingBlock,
  ImageBlock,
  ButtonBlock,
  DividerBlock,
  SpacerBlock,
  SocialBlock,
  HtmlBlock,
  SocialNetwork,
} from '@/lib/email-designer-types';
import {
  createDefaultBlock,
  createSection,
  createEmptyDesign,
  generateId,
  BLOCK_TYPES,
  COLUMN_LAYOUTS,
  FONT_OPTIONS,
  SOCIAL_PLATFORMS,
} from '@/lib/email-designer-types';
import { renderEmailDesign, renderEmailDesignText } from '@/lib/email-designer-render';

// ============ TYPES ============

interface EmailDesignerProps {
  initialDesign?: EmailDesign;
  brandName: string;
  onSave: (html: string, text: string, designJson: string) => void;
  onClose: () => void;
}

interface DragData {
  type: 'new-block' | 'move-block';
  blockType?: EmailBlockType;
  sourceSectionId?: string;
  sourceColumnId?: string;
  sourceBlockId?: string;
}

interface SelectedBlock {
  sectionId: string;
  columnId: string;
  blockId: string;
}

// ============ UNDO/REDO ============

function useHistory(initial: EmailDesign) {
  const [past, setPast] = useState<EmailDesign[]>([]);
  const [present, setPresent] = useState<EmailDesign>(initial);
  const [future, setFuture] = useState<EmailDesign[]>([]);

  const update = useCallback((newDesign: EmailDesign) => {
    setPast(p => [...p.slice(-30), present]);
    setPresent(newDesign);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    setFuture(f => [present, ...f]);
    setPresent(past[past.length - 1]);
    setPast(p => p.slice(0, -1));
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    setPast(p => [...p, present]);
    setPresent(future[0]);
    setFuture(f => f.slice(1));
  }, [future, present]);

  return { design: present, update, undo, redo, canUndo: past.length > 0, canRedo: future.length > 0 };
}

// ============ MAIN COMPONENT ============

export default function EmailDesigner({ initialDesign, brandName, onSave, onClose }: EmailDesignerProps) {
  const { design, update, undo, redo, canUndo, canRedo } = useHistory(
    initialDesign || createEmptyDesign()
  );
  const [selected, setSelected] = useState<SelectedBlock | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'content' | 'style'>('content');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const dragDataRef = useRef<DragData | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Get selected block data
  const selectedBlock = selected
    ? (() => {
        const section = design.sections.find(s => s.id === selected.sectionId);
        const column = section?.columns.find(c => c.id === selected.columnId);
        return column?.blocks.find(b => b.id === selected.blockId) || null;
      })()
    : null;

  const selectedSection = selected
    ? design.sections.find(s => s.id === selected.sectionId) || null
    : null;

  // ============ DESIGN OPERATIONS ============

  function updateGlobalStyles(updates: Partial<EmailGlobalStyles>) {
    update({ ...design, globalStyles: { ...design.globalStyles, ...updates } });
  }

  function addSection(columnWidths: number[], insertAfterSectionId?: string) {
    const newSection = createSection(columnWidths);
    const sections = [...design.sections];
    if (insertAfterSectionId) {
      const idx = sections.findIndex(s => s.id === insertAfterSectionId);
      sections.splice(idx + 1, 0, newSection);
    } else {
      sections.push(newSection);
    }
    update({ ...design, sections });
  }

  function addPrebuiltSection(section: EmailSection) {
    // Deep clone with fresh IDs
    const cloned: EmailSection = {
      ...section,
      id: generateId(),
      columns: section.columns.map(c => ({
        ...c,
        id: generateId(),
        blocks: c.blocks.map(b => ({ ...b, id: generateId() })),
      })),
    };
    update({ ...design, sections: [...design.sections, cloned] });
  }

  function deleteSection(sectionId: string) {
    update({ ...design, sections: design.sections.filter(s => s.id !== sectionId) });
    if (selected?.sectionId === sectionId) setSelected(null);
  }

  function updateSection(sectionId: string, updates: Partial<EmailSection>) {
    update({
      ...design,
      sections: design.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s),
    });
  }

  function moveSectionUp(sectionId: string) {
    const idx = design.sections.findIndex(s => s.id === sectionId);
    if (idx <= 0) return;
    const sections = [...design.sections];
    [sections[idx - 1], sections[idx]] = [sections[idx], sections[idx - 1]];
    update({ ...design, sections });
  }

  function moveSectionDown(sectionId: string) {
    const idx = design.sections.findIndex(s => s.id === sectionId);
    if (idx < 0 || idx >= design.sections.length - 1) return;
    const sections = [...design.sections];
    [sections[idx], sections[idx + 1]] = [sections[idx + 1], sections[idx]];
    update({ ...design, sections });
  }

  function duplicateSection(sectionId: string) {
    const section = design.sections.find(s => s.id === sectionId);
    if (!section) return;
    const newSection: EmailSection = {
      ...JSON.parse(JSON.stringify(section)),
      id: generateId(),
      columns: section.columns.map(c => ({
        ...JSON.parse(JSON.stringify(c)),
        id: generateId(),
        blocks: c.blocks.map(b => ({ ...JSON.parse(JSON.stringify(b)), id: generateId() })),
      })),
    };
    const idx = design.sections.findIndex(s => s.id === sectionId);
    const sections = [...design.sections];
    sections.splice(idx + 1, 0, newSection);
    update({ ...design, sections });
  }

  function addBlockToColumn(sectionId: string, columnId: string, blockType: EmailBlockType, insertIndex?: number) {
    const block = createDefaultBlock(blockType);
    update({
      ...design,
      sections: design.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          columns: s.columns.map(c => {
            if (c.id !== columnId) return c;
            const blocks = [...c.blocks];
            if (insertIndex !== undefined) {
              blocks.splice(insertIndex, 0, block);
            } else {
              blocks.push(block);
            }
            return { ...c, blocks };
          }),
        };
      }),
    });
    setSelected({ sectionId, columnId, blockId: block.id });
    setSidebarTab('content');
  }

  function updateBlock(sectionId: string, columnId: string, blockId: string, updates: Partial<EmailBlock>) {
    update({
      ...design,
      sections: design.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          columns: s.columns.map(c => {
            if (c.id !== columnId) return c;
            return {
              ...c,
              blocks: c.blocks.map(b =>
                b.id === blockId ? { ...b, ...updates } as EmailBlock : b
              ),
            };
          }),
        };
      }),
    });
  }

  function deleteBlock(sectionId: string, columnId: string, blockId: string) {
    update({
      ...design,
      sections: design.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          columns: s.columns.map(c => {
            if (c.id !== columnId) return c;
            return { ...c, blocks: c.blocks.filter(b => b.id !== blockId) };
          }),
        };
      }),
    });
    if (selected?.blockId === blockId) setSelected(null);
  }

  function moveBlockUp(sectionId: string, columnId: string, blockId: string) {
    update({
      ...design,
      sections: design.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          columns: s.columns.map(c => {
            if (c.id !== columnId) return c;
            const idx = c.blocks.findIndex(b => b.id === blockId);
            if (idx <= 0) return c;
            const blocks = [...c.blocks];
            [blocks[idx - 1], blocks[idx]] = [blocks[idx], blocks[idx - 1]];
            return { ...c, blocks };
          }),
        };
      }),
    });
  }

  function moveBlockDown(sectionId: string, columnId: string, blockId: string) {
    update({
      ...design,
      sections: design.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          columns: s.columns.map(c => {
            if (c.id !== columnId) return c;
            const idx = c.blocks.findIndex(b => b.id === blockId);
            if (idx < 0 || idx >= c.blocks.length - 1) return c;
            const blocks = [...c.blocks];
            [blocks[idx], blocks[idx + 1]] = [blocks[idx + 1], blocks[idx]];
            return { ...c, blocks };
          }),
        };
      }),
    });
  }

  function duplicateBlock(sectionId: string, columnId: string, blockId: string) {
    update({
      ...design,
      sections: design.sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          columns: s.columns.map(c => {
            if (c.id !== columnId) return c;
            const idx = c.blocks.findIndex(b => b.id === blockId);
            if (idx < 0) return c;
            const copy = { ...JSON.parse(JSON.stringify(c.blocks[idx])), id: generateId() };
            const blocks = [...c.blocks];
            blocks.splice(idx + 1, 0, copy);
            return { ...c, blocks };
          }),
        };
      }),
    });
  }

  // ============ DRAG AND DROP ============

  function handleDragStartNewBlock(e: React.DragEvent, blockType: EmailBlockType) {
    dragDataRef.current = { type: 'new-block', blockType };
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', blockType);
  }

  function handleDragStartExistingBlock(e: React.DragEvent, sectionId: string, columnId: string, blockId: string) {
    dragDataRef.current = { type: 'move-block', sourceSectionId: sectionId, sourceColumnId: columnId, sourceBlockId: blockId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragDataRef.current?.type === 'new-block' ? 'copy' : 'move';
    setDragOverTarget(targetId);
  }

  function handleDragLeave() {
    setDragOverTarget(null);
  }

  function handleDropOnColumn(e: React.DragEvent, sectionId: string, columnId: string, insertIndex: number) {
    e.preventDefault();
    setDragOverTarget(null);
    const data = dragDataRef.current;
    if (!data) return;

    if (data.type === 'new-block' && data.blockType) {
      addBlockToColumn(sectionId, columnId, data.blockType, insertIndex);
    } else if (data.type === 'move-block' && data.sourceSectionId && data.sourceColumnId && data.sourceBlockId) {
      // Find the source block
      const sourceSection = design.sections.find(s => s.id === data.sourceSectionId);
      const sourceColumn = sourceSection?.columns.find(c => c.id === data.sourceColumnId);
      const sourceBlock = sourceColumn?.blocks.find(b => b.id === data.sourceBlockId);
      if (!sourceBlock) return;

      // Remove from source, add to target
      const blockCopy = { ...sourceBlock };
      let newDesign = { ...design };

      // Remove from source
      newDesign = {
        ...newDesign,
        sections: newDesign.sections.map(s => {
          if (s.id !== data.sourceSectionId) return s;
          return {
            ...s,
            columns: s.columns.map(c => {
              if (c.id !== data.sourceColumnId) return c;
              return { ...c, blocks: c.blocks.filter(b => b.id !== data.sourceBlockId) };
            }),
          };
        }),
      };

      // If same column, adjust index
      let adjustedIndex = insertIndex;
      if (data.sourceSectionId === sectionId && data.sourceColumnId === columnId && sourceColumn) {
        const origIdx = sourceColumn.blocks.findIndex(b => b.id === data.sourceBlockId);
        if (origIdx >= 0 && origIdx < insertIndex) adjustedIndex--;
      }

      // Add to target
      newDesign = {
        ...newDesign,
        sections: newDesign.sections.map(s => {
          if (s.id !== sectionId) return s;
          return {
            ...s,
            columns: s.columns.map(c => {
              if (c.id !== columnId) return c;
              const blocks = [...c.blocks];
              blocks.splice(adjustedIndex, 0, blockCopy);
              return { ...c, blocks };
            }),
          };
        }),
      };

      update(newDesign);
      setSelected({ sectionId, columnId, blockId: blockCopy.id });
    }

    dragDataRef.current = null;
  }

  function handleDropNewSection(e: React.DragEvent, insertAfterSectionId?: string) {
    e.preventDefault();
    setDragOverTarget(null);
    const data = dragDataRef.current;
    if (!data || data.type !== 'new-block' || !data.blockType) return;

    const block = createDefaultBlock(data.blockType);
    const section = createSection([100]);
    section.columns[0].blocks.push(block);

    const sections = [...design.sections];
    if (insertAfterSectionId) {
      const idx = sections.findIndex(s => s.id === insertAfterSectionId);
      sections.splice(idx + 1, 0, section);
    } else {
      sections.push(section);
    }

    update({ ...design, sections });
    setSelected({ sectionId: section.id, columnId: section.columns[0].id, blockId: block.id });
    dragDataRef.current = null;
  }

  // ============ SAVE ============

  function handleSave() {
    const html = renderEmailDesign(design);
    const text = renderEmailDesignText(design);
    const json = JSON.stringify(design);
    onSave(html, text, json);
  }

  // ============ KEYBOARD ============

  // Use refs for values used in keyboard handler to avoid stale closures
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const deleteBlockRef = useRef(deleteBlock);
  deleteBlockRef.current = deleteBlock;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      const sel = selectedRef.current;
      if (e.key === 'Delete' && sel && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        deleteBlockRef.current(sel.sectionId, sel.columnId, sel.blockId);
      }
      if (e.key === 'Escape') {
        setSelected(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // ============ RENDER ============

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ isolation: 'isolate' }}>
      {/* Top Bar */}
      <div className="h-14 border-b bg-white flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 flex items-center gap-1"
          >
            <span className="text-lg leading-none">&larr;</span> Back
          </button>
          <span className="text-sm font-medium text-gray-700">Email Designer</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <button onClick={undo} disabled={!canUndo} className="p-2 rounded hover:bg-gray-100 disabled:opacity-30" title="Undo (Ctrl+Z)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/></svg>
          </button>
          <button onClick={redo} disabled={!canRedo} className="p-2 rounded hover:bg-gray-100 disabled:opacity-30" title="Redo (Ctrl+Y)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 7"/></svg>
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Preview toggle */}
          <div className="flex border rounded-md overflow-hidden">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`px-3 py-1.5 text-xs font-medium ${previewMode === 'desktop' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`px-3 py-1.5 text-xs font-medium ${previewMode === 'mobile' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              Mobile
            </button>
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Save &amp; Close
          </button>
        </div>
      </div>

      {/* Main content: Sidebar + Canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r bg-gray-50 flex flex-col overflow-hidden shrink-0">
          {/* Sidebar Tabs */}
          {!selected ? (
            <>
              <div className="flex border-b shrink-0">
                <button
                  onClick={() => setSidebarTab('content')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium ${sidebarTab === 'content' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Content
                </button>
                <button
                  onClick={() => setSidebarTab('style')}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium ${sidebarTab === 'style' ? 'border-b-2 border-indigo-600 text-indigo-600 bg-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Style
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3">
                {sidebarTab === 'content' ? (
                  <ContentPanel onDragStart={handleDragStartNewBlock} onAddSection={addSection} onAddPrebuiltSection={addPrebuiltSection} globalStyles={design.globalStyles} />
                ) : (
                  <StylePanel globalStyles={design.globalStyles} onChange={updateGlobalStyles} />
                )}
              </div>
            </>
          ) : (
            /* Block Settings */
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-center justify-between p-3 border-b bg-white">
                <span className="text-sm font-medium">Block Settings</span>
                <button onClick={() => setSelected(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
                  Done
                </button>
              </div>
              <div className="p-3">
                {selectedBlock && selected && (
                  <BlockSettings
                    block={selectedBlock}
                    section={selectedSection!}
                    globalStyles={design.globalStyles}
                    onChange={(updates) => updateBlock(selected.sectionId, selected.columnId, selected.blockId, updates)}
                    onSectionChange={(updates) => updateSection(selected.sectionId, updates)}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div
          className="flex-1 overflow-auto bg-gray-200"
          onClick={(e) => {
            if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-canvas-bg]')) {
              setSelected(null);
            }
          }}
          ref={canvasRef}
        >
          <div className="min-h-full flex justify-center py-8" data-canvas-bg>
            <div
              style={{
                width: previewMode === 'mobile' ? 375 : design.globalStyles.bodyWidth,
                transition: 'width 0.3s ease',
              }}
            >
              {/* Email container */}
              <div
                style={{
                  backgroundColor: design.globalStyles.contentBackgroundColor,
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                  fontFamily: design.globalStyles.fontFamily,
                }}
              >
                {/* Empty state */}
                {design.sections.length === 0 && (
                  <div
                    className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                      dragOverTarget === 'empty-canvas'
                        ? 'border-indigo-400 bg-indigo-50'
                        : 'border-gray-300'
                    }`}
                    onDragOver={(e) => handleDragOver(e, 'empty-canvas')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropNewSection(e)}
                  >
                    <div className="text-gray-400 mb-2">
                      <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    </div>
                    <p className="text-sm text-gray-500 font-medium">Drag blocks here to start designing</p>
                    <p className="text-xs text-gray-400 mt-1">Or add a section from the sidebar</p>
                  </div>
                )}

                {/* Sections */}
                {design.sections.map((section, sIdx) => (
                  <div key={section.id}>
                    {/* Drop zone before section */}
                    <DropZone
                      id={`before-section-${section.id}`}
                      isActive={dragOverTarget === `before-section-${section.id}`}
                      onDragOver={(e) => handleDragOver(e, `before-section-${section.id}`)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDropNewSection(e, sIdx > 0 ? design.sections[sIdx - 1].id : undefined)}
                    />

                    {/* Section */}
                    <SectionRenderer
                      section={section}
                      globalStyles={design.globalStyles}
                      selected={selected}
                      dragOverTarget={dragOverTarget}
                      isFirst={sIdx === 0}
                      isLast={sIdx === design.sections.length - 1}
                      onSelectBlock={(columnId, blockId) => setSelected({ sectionId: section.id, columnId, blockId })}
                      onDragStartBlock={handleDragStartExistingBlock}
                      onDragOverBlock={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDropOnColumn={handleDropOnColumn}
                      onDeleteSection={() => deleteSection(section.id)}
                      onDuplicateSection={() => duplicateSection(section.id)}
                      onMoveSectionUp={() => moveSectionUp(section.id)}
                      onMoveSectionDown={() => moveSectionDown(section.id)}
                      onDeleteBlock={deleteBlock}
                      onMoveBlockUp={moveBlockUp}
                      onMoveBlockDown={moveBlockDown}
                      onDuplicateBlock={duplicateBlock}
                    />
                  </div>
                ))}

                {/* Drop zone after last section */}
                {design.sections.length > 0 && (
                  <DropZone
                    id="after-last-section"
                    isActive={dragOverTarget === 'after-last-section'}
                    onDragOver={(e) => handleDragOver(e, 'after-last-section')}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDropNewSection(e, design.sections[design.sections.length - 1]?.id)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ CONTENT PANEL ============

// Pre-built section templates for Quick Add
function getPrebuiltSections(gs: EmailGlobalStyles): { label: string; icon: string; section: EmailSection }[] {
  return [
    {
      label: 'Header',
      icon: 'H',
      section: {
        id: '', columns: [{
          id: '', width: 100, blocks: [
            { type: 'heading', id: '', content: 'Your Brand', level: 2, align: 'center', color: gs.linkColor, paddingTop: 25, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
            { type: 'divider', id: '', color: '#e5e7eb', thickness: 1, width: 40, style: 'solid' as const, paddingTop: 5, paddingBottom: 10 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    },
    {
      label: 'Hero',
      icon: 'H1',
      section: {
        id: '', columns: [{
          id: '', width: 100, blocks: [
            { type: 'heading', id: '', content: 'Your Headline Here', level: 1, align: 'center', color: '', paddingTop: 30, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
            { type: 'text', id: '', content: '<p>Supporting text that describes your main message. Keep it short and engaging.</p>', align: 'center', fontSize: 16, color: '#6b7280', lineHeight: 1.6, paddingTop: 0, paddingBottom: 15, paddingLeft: 40, paddingRight: 40 },
            { type: 'button', id: '', text: 'Call to Action', url: '{{targetUrl}}', align: 'center', backgroundColor: '', textColor: '', borderRadius: gs.buttonBorderRadius, fontSize: 18, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    },
    {
      label: 'Image + Text',
      icon: 'IT',
      section: {
        id: '', columns: [{
          id: '', width: 100, blocks: [
            { type: 'image', id: '', src: '', alt: 'Featured image', width: 100, align: 'center', link: '', borderRadius: 8, paddingTop: 10, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
            { type: 'heading', id: '', content: 'Section Title', level: 2, align: 'left', color: '', paddingTop: 10, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
            { type: 'text', id: '', content: '<p>Add your content here. Tell your story and engage your readers.</p>', align: 'left', fontSize: 16, color: '', lineHeight: 1.6, paddingTop: 0, paddingBottom: 10, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    },
    {
      label: 'CTA Banner',
      icon: 'CTA',
      section: {
        id: '', columns: [{
          id: '', width: 100, blocks: [
            { type: 'heading', id: '', content: 'Ready to get started?', level: 2, align: 'center', color: '#ffffff', paddingTop: 30, paddingBottom: 5, paddingLeft: 20, paddingRight: 20 },
            { type: 'text', id: '', content: '<p style="color:#e0e0e0;">Join thousands of happy customers today.</p>', align: 'center', fontSize: 16, color: '#e0e0e0', lineHeight: 1.6, paddingTop: 0, paddingBottom: 10, paddingLeft: 40, paddingRight: 40 },
            { type: 'button', id: '', text: 'Get Started', url: '{{targetUrl}}', align: 'center', backgroundColor: '#ffffff', textColor: gs.linkColor, borderRadius: gs.buttonBorderRadius, fontSize: 16, fullWidth: false, paddingTop: 5, paddingBottom: 30, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: gs.linkColor, paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    },
    {
      label: 'Footer',
      icon: 'F',
      section: {
        id: '', columns: [{
          id: '', width: 100, blocks: [
            { type: 'divider', id: '', color: '#e5e7eb', thickness: 1, width: 100, style: 'solid' as const, paddingTop: 15, paddingBottom: 10 },
            { type: 'social', id: '', networks: [
              { platform: 'facebook', url: '#', label: 'Facebook' },
              { platform: 'twitter', url: '#', label: 'Twitter' },
              { platform: 'instagram', url: '#', label: 'Instagram' },
              { platform: 'linkedin', url: '#', label: 'LinkedIn' },
            ], align: 'center' as const, iconSize: 28, iconStyle: 'color' as const, paddingTop: 10, paddingBottom: 10 },
            { type: 'text', id: '', content: '<p style="font-size:12px;color:#9ca3af;">You received this email because you subscribed.<br/>{{unsubscribeLink}}</p>', align: 'center', fontSize: 12, color: '#9ca3af', lineHeight: 1.4, paddingTop: 5, paddingBottom: 20, paddingLeft: 20, paddingRight: 20 },
          ],
        }], backgroundColor: '', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    },
    {
      label: 'Testimonial',
      icon: 'Q',
      section: {
        id: '', columns: [{
          id: '', width: 100, blocks: [
            { type: 'text', id: '', content: '<p style="font-style:italic;font-size:18px;">"This product changed everything for our team. We couldn\'t be happier with the results."</p>', align: 'center', fontSize: 18, color: '', lineHeight: 1.7, paddingTop: 25, paddingBottom: 5, paddingLeft: 40, paddingRight: 40 },
            { type: 'text', id: '', content: '<p><strong>Jane Doe</strong><br/>CEO at Company</p>', align: 'center', fontSize: 14, color: '#6b7280', lineHeight: 1.4, paddingTop: 5, paddingBottom: 25, paddingLeft: 40, paddingRight: 40 },
          ],
        }], backgroundColor: '#f9fafb', paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0,
      },
    },
  ];
}

function ContentPanel({
  onDragStart,
  onAddSection,
  onAddPrebuiltSection,
  globalStyles,
}: {
  onDragStart: (e: React.DragEvent, type: EmailBlockType) => void;
  onAddSection: (widths: number[]) => void;
  onAddPrebuiltSection: (section: EmailSection) => void;
  globalStyles: EmailGlobalStyles;
}) {
  const prebuiltSections = getPrebuiltSections(globalStyles);

  return (
    <div className="space-y-4">
      {/* Quick Add Section Templates */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Add</h3>
        <div className="grid grid-cols-2 gap-2">
          {prebuiltSections.map(({ label, icon, section }) => (
            <button
              key={label}
              onClick={() => onAddPrebuiltSection(section)}
              className="flex flex-col items-center gap-1 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs hover:bg-indigo-100 hover:border-indigo-300 transition-all"
            >
              <span className="text-xs font-bold text-indigo-600 leading-none">{icon}</span>
              <span className="text-xs text-indigo-700">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Blocks</h3>
        <div className="grid grid-cols-2 gap-2">
          {BLOCK_TYPES.map(({ type, label, icon }) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onDragStart(e, type)}
              className="flex flex-col items-center gap-1.5 p-3 bg-white border rounded-lg cursor-grab hover:border-indigo-300 hover:shadow-sm transition-all active:cursor-grabbing select-none"
            >
              <span className="text-lg leading-none text-gray-600">{icon}</span>
              <span className="text-xs text-gray-600">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sections</h3>
        <div className="space-y-1.5">
          {COLUMN_LAYOUTS.map(({ label, widths }) => (
            <button
              key={label}
              onClick={() => onAddSection([...widths])}
              className="w-full text-left px-3 py-2 bg-white border rounded-lg text-xs hover:border-indigo-300 hover:shadow-sm transition-all flex items-center gap-2"
            >
              <div className="flex gap-0.5 flex-1">
                {widths.map((w, i) => (
                  <div
                    key={i}
                    className="h-6 bg-gray-200 rounded-sm"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
              <span className="text-gray-600 shrink-0">{label}</span>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}

// ============ STYLE PANEL ============

function StylePanel({
  globalStyles,
  onChange,
}: {
  globalStyles: EmailGlobalStyles;
  onChange: (updates: Partial<EmailGlobalStyles>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Layout */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Layout</h3>
        <div className="space-y-2.5">
          <SettingRow label="Body Width">
            <input
              type="number"
              value={globalStyles.bodyWidth}
              onChange={(e) => onChange({ bodyWidth: parseInt(e.target.value) || 600 })}
              className="w-20 text-xs border rounded px-2 py-1.5"
              min={320}
              max={800}
            />
            <span className="text-xs text-gray-400">px</span>
          </SettingRow>
          <SettingRow label="Background">
            <ColorInput value={globalStyles.backgroundColor} onChange={(v) => onChange({ backgroundColor: v })} />
          </SettingRow>
          <SettingRow label="Content Background">
            <ColorInput value={globalStyles.contentBackgroundColor} onChange={(v) => onChange({ contentBackgroundColor: v })} />
          </SettingRow>
        </div>
      </div>

      {/* Text */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Text</h3>
        <div className="space-y-2.5">
          <SettingRow label="Font">
            <select
              value={globalStyles.fontFamily}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="text-xs border rounded px-2 py-1.5 w-full"
            >
              {FONT_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label="Heading Color">
            <ColorInput value={globalStyles.headingColor} onChange={(v) => onChange({ headingColor: v })} />
          </SettingRow>
          <SettingRow label="Text Color">
            <ColorInput value={globalStyles.textColor} onChange={(v) => onChange({ textColor: v })} />
          </SettingRow>
          <SettingRow label="Link Color">
            <ColorInput value={globalStyles.linkColor} onChange={(v) => onChange({ linkColor: v })} />
          </SettingRow>
        </div>
      </div>

      {/* Buttons */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Buttons</h3>
        <div className="space-y-2.5">
          <SettingRow label="Background">
            <ColorInput value={globalStyles.buttonBackgroundColor} onChange={(v) => onChange({ buttonBackgroundColor: v })} />
          </SettingRow>
          <SettingRow label="Text">
            <ColorInput value={globalStyles.buttonTextColor} onChange={(v) => onChange({ buttonTextColor: v })} />
          </SettingRow>
          <SettingRow label="Radius">
            <input
              type="number"
              value={globalStyles.buttonBorderRadius}
              onChange={(e) => onChange({ buttonBorderRadius: parseInt(e.target.value) || 0 })}
              className="w-16 text-xs border rounded px-2 py-1.5"
              min={0}
              max={50}
            />
            <span className="text-xs text-gray-400">px</span>
          </SettingRow>
        </div>
      </div>

      {/* Spacing */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Spacing</h3>
        <div className="space-y-2.5">
          <SettingRow label="Top Padding">
            <input
              type="number"
              value={globalStyles.paddingTop}
              onChange={(e) => onChange({ paddingTop: parseInt(e.target.value) || 0 })}
              className="w-16 text-xs border rounded px-2 py-1.5"
              min={0}
              max={100}
            />
            <span className="text-xs text-gray-400">px</span>
          </SettingRow>
          <SettingRow label="Bottom Padding">
            <input
              type="number"
              value={globalStyles.paddingBottom}
              onChange={(e) => onChange({ paddingBottom: parseInt(e.target.value) || 0 })}
              className="w-16 text-xs border rounded px-2 py-1.5"
              min={0}
              max={100}
            />
            <span className="text-xs text-gray-400">px</span>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

// ============ BLOCK SETTINGS PANEL ============

function BlockSettings({
  block,
  section,
  globalStyles,
  onChange,
  onSectionChange,
}: {
  block: EmailBlock;
  section: EmailSection;
  globalStyles: EmailGlobalStyles;
  onChange: (updates: Partial<EmailBlock>) => void;
  onSectionChange: (updates: Partial<EmailSection>) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Common: Block type header */}
      <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
        {block.type} Block
      </div>

      {/* Type-specific settings */}
      {block.type === 'text' && <TextBlockSettings block={block} onChange={onChange} globalStyles={globalStyles} />}
      {block.type === 'heading' && <HeadingBlockSettings block={block} onChange={onChange} />}
      {block.type === 'image' && <ImageBlockSettings block={block} onChange={onChange} />}
      {block.type === 'button' && <ButtonBlockSettings block={block} onChange={onChange} globalStyles={globalStyles} />}
      {block.type === 'divider' && <DividerBlockSettings block={block} onChange={onChange} />}
      {block.type === 'spacer' && <SpacerBlockSettings block={block} onChange={onChange} />}
      {block.type === 'social' && <SocialBlockSettings block={block} onChange={onChange} />}
      {block.type === 'html' && <HtmlBlockSettings block={block} onChange={onChange} />}

      {/* Section settings */}
      <div className="pt-3 border-t">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Section</h4>
        <div className="space-y-2.5">
          <SettingRow label="Background">
            <ColorInput
              value={section.backgroundColor}
              onChange={(v) => onSectionChange({ backgroundColor: v })}
            />
          </SettingRow>
          <SettingRow label="Padding">
            <div className="grid grid-cols-4 gap-1">
              <input type="number" value={section.paddingTop} onChange={(e) => onSectionChange({ paddingTop: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1.5 py-1 text-center" placeholder="T" min={0} />
              <input type="number" value={section.paddingRight} onChange={(e) => onSectionChange({ paddingRight: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1.5 py-1 text-center" placeholder="R" min={0} />
              <input type="number" value={section.paddingBottom} onChange={(e) => onSectionChange({ paddingBottom: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1.5 py-1 text-center" placeholder="B" min={0} />
              <input type="number" value={section.paddingLeft} onChange={(e) => onSectionChange({ paddingLeft: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1.5 py-1 text-center" placeholder="L" min={0} />
            </div>
          </SettingRow>
        </div>
      </div>
    </div>
  );
}

function TextBlockSettings({ block, onChange, globalStyles }: { block: TextBlock; onChange: (u: Partial<TextBlock>) => void; globalStyles: EmailGlobalStyles }) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Content</label>
        <textarea
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5 h-24 font-mono"
          placeholder="<p>Your text here...</p>"
        />
        <p className="text-xs text-gray-400 mt-0.5">HTML supported. Use {'{{firstName}}'} for personalization.</p>
      </div>
      <SettingRow label="Align">
        <AlignButtons value={block.align} onChange={(v) => onChange({ align: v })} />
      </SettingRow>
      <SettingRow label="Font Size">
        <input type="number" value={block.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 16 })} className="w-16 text-xs border rounded px-2 py-1.5" min={10} max={36} />
        <span className="text-xs text-gray-400">px</span>
      </SettingRow>
      <SettingRow label="Color">
        <ColorInput value={block.color || globalStyles.textColor} onChange={(v) => onChange({ color: v })} />
      </SettingRow>
      <SettingRow label="Line Height">
        <input type="number" value={block.lineHeight} onChange={(e) => onChange({ lineHeight: parseFloat(e.target.value) || 1.6 })} className="w-16 text-xs border rounded px-2 py-1.5" min={1} max={3} step={0.1} />
      </SettingRow>
      <PaddingSettings
        top={block.paddingTop} right={block.paddingRight} bottom={block.paddingBottom} left={block.paddingLeft}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}

function HeadingBlockSettings({ block, onChange }: { block: HeadingBlock; onChange: (u: Partial<HeadingBlock>) => void }) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Text</label>
        <input
          type="text"
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5"
        />
      </div>
      <SettingRow label="Level">
        <div className="flex gap-1">
          {([1, 2, 3] as const).map(l => (
            <button
              key={l}
              onClick={() => onChange({ level: l })}
              className={`px-2.5 py-1 text-xs rounded border ${block.level === l ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              H{l}
            </button>
          ))}
        </div>
      </SettingRow>
      <SettingRow label="Align">
        <AlignButtons value={block.align} onChange={(v) => onChange({ align: v })} />
      </SettingRow>
      <SettingRow label="Color">
        <ColorInput value={block.color} onChange={(v) => onChange({ color: v })} />
      </SettingRow>
      <PaddingSettings
        top={block.paddingTop} right={block.paddingRight} bottom={block.paddingBottom} left={block.paddingLeft}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}

function ImageBlockSettings({ block, onChange }: { block: ImageBlock; onChange: (u: Partial<ImageBlock>) => void }) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Image URL</label>
        <input
          type="url"
          value={block.src}
          onChange={(e) => onChange({ src: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5"
          placeholder="https://example.com/image.jpg"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Alt Text</label>
        <input
          type="text"
          value={block.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5"
          placeholder="Describe the image"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">Link URL (optional)</label>
        <input
          type="url"
          value={block.link}
          onChange={(e) => onChange({ link: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5"
          placeholder="https://example.com"
        />
      </div>
      <SettingRow label="Width">
        <input type="range" value={block.width} onChange={(e) => onChange({ width: parseInt(e.target.value) })} className="flex-1" min={10} max={100} />
        <span className="text-xs text-gray-500 w-8 text-right">{block.width}%</span>
      </SettingRow>
      <SettingRow label="Align">
        <AlignButtons value={block.align} onChange={(v) => onChange({ align: v })} />
      </SettingRow>
      <SettingRow label="Radius">
        <input type="number" value={block.borderRadius} onChange={(e) => onChange({ borderRadius: parseInt(e.target.value) || 0 })} className="w-16 text-xs border rounded px-2 py-1.5" min={0} max={50} />
        <span className="text-xs text-gray-400">px</span>
      </SettingRow>
      <PaddingSettings
        top={block.paddingTop} right={block.paddingRight} bottom={block.paddingBottom} left={block.paddingLeft}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}

function ButtonBlockSettings({ block, onChange, globalStyles }: { block: ButtonBlock; onChange: (u: Partial<ButtonBlock>) => void; globalStyles: EmailGlobalStyles }) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Button Text</label>
        <input
          type="text"
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">URL</label>
        <input
          type="text"
          value={block.url}
          onChange={(e) => onChange({ url: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5"
          placeholder="https://example.com or {{targetUrl}}"
        />
      </div>
      <SettingRow label="Align">
        <AlignButtons value={block.align} onChange={(v) => onChange({ align: v })} />
      </SettingRow>
      <SettingRow label="Background">
        <ColorInput value={block.backgroundColor || globalStyles.buttonBackgroundColor} onChange={(v) => onChange({ backgroundColor: v })} />
      </SettingRow>
      <SettingRow label="Text Color">
        <ColorInput value={block.textColor || globalStyles.buttonTextColor} onChange={(v) => onChange({ textColor: v })} />
      </SettingRow>
      <SettingRow label="Radius">
        <input type="number" value={block.borderRadius} onChange={(e) => onChange({ borderRadius: parseInt(e.target.value) || 0 })} className="w-16 text-xs border rounded px-2 py-1.5" min={0} max={50} />
        <span className="text-xs text-gray-400">px</span>
      </SettingRow>
      <SettingRow label="Font Size">
        <input type="number" value={block.fontSize} onChange={(e) => onChange({ fontSize: parseInt(e.target.value) || 16 })} className="w-16 text-xs border rounded px-2 py-1.5" min={10} max={30} />
        <span className="text-xs text-gray-400">px</span>
      </SettingRow>
      <SettingRow label="Full Width">
        <input type="checkbox" checked={block.fullWidth} onChange={(e) => onChange({ fullWidth: e.target.checked })} className="rounded" />
      </SettingRow>
      <PaddingSettings
        top={block.paddingTop} right={block.paddingRight} bottom={block.paddingBottom} left={block.paddingLeft}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}

function DividerBlockSettings({ block, onChange }: { block: DividerBlock; onChange: (u: Partial<DividerBlock>) => void }) {
  return (
    <div className="space-y-2.5">
      <SettingRow label="Color">
        <ColorInput value={block.color} onChange={(v) => onChange({ color: v })} />
      </SettingRow>
      <SettingRow label="Thickness">
        <input type="number" value={block.thickness} onChange={(e) => onChange({ thickness: parseInt(e.target.value) || 1 })} className="w-16 text-xs border rounded px-2 py-1.5" min={1} max={10} />
        <span className="text-xs text-gray-400">px</span>
      </SettingRow>
      <SettingRow label="Width">
        <input type="range" value={block.width} onChange={(e) => onChange({ width: parseInt(e.target.value) })} className="flex-1" min={10} max={100} />
        <span className="text-xs text-gray-500 w-8 text-right">{block.width}%</span>
      </SettingRow>
      <SettingRow label="Style">
        <select value={block.style} onChange={(e) => onChange({ style: e.target.value as 'solid' | 'dashed' | 'dotted' })} className="text-xs border rounded px-2 py-1.5">
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </SettingRow>
      <SettingRow label="Padding Top">
        <input type="number" value={block.paddingTop} onChange={(e) => onChange({ paddingTop: parseInt(e.target.value) || 0 })} className="w-16 text-xs border rounded px-2 py-1.5" min={0} max={100} />
      </SettingRow>
      <SettingRow label="Padding Bottom">
        <input type="number" value={block.paddingBottom} onChange={(e) => onChange({ paddingBottom: parseInt(e.target.value) || 0 })} className="w-16 text-xs border rounded px-2 py-1.5" min={0} max={100} />
      </SettingRow>
    </div>
  );
}

function SpacerBlockSettings({ block, onChange }: { block: SpacerBlock; onChange: (u: Partial<SpacerBlock>) => void }) {
  return (
    <div className="space-y-2.5">
      <SettingRow label="Height">
        <input type="range" value={block.height} onChange={(e) => onChange({ height: parseInt(e.target.value) })} className="flex-1" min={5} max={100} />
        <span className="text-xs text-gray-500 w-8 text-right">{block.height}px</span>
      </SettingRow>
    </div>
  );
}

function SocialBlockSettings({ block, onChange }: { block: SocialBlock; onChange: (u: Partial<SocialBlock>) => void }) {
  function updateNetwork(index: number, updates: Partial<SocialNetwork>) {
    const networks = block.networks.map((n, i) => i === index ? { ...n, ...updates } : n);
    onChange({ networks });
  }

  function addNetwork() {
    const used = new Set(block.networks.map(n => n.platform));
    const available = SOCIAL_PLATFORMS.find(p => !used.has(p.platform));
    if (!available) return;
    onChange({ networks: [...block.networks, { platform: available.platform, url: '', label: available.label }] });
  }

  function removeNetwork(index: number) {
    onChange({ networks: block.networks.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 block mb-1">Social Networks</label>
        <div className="space-y-2">
          {block.networks.map((network, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <select
                value={network.platform}
                onChange={(e) => {
                  const sp = SOCIAL_PLATFORMS.find(p => p.platform === e.target.value);
                  updateNetwork(idx, { platform: e.target.value, label: sp?.label || e.target.value });
                }}
                className="text-xs border rounded px-1.5 py-1 w-20"
              >
                {SOCIAL_PLATFORMS.map(p => (
                  <option key={p.platform} value={p.platform}>{p.label}</option>
                ))}
              </select>
              <input
                type="url"
                value={network.url}
                onChange={(e) => updateNetwork(idx, { url: e.target.value })}
                className="flex-1 text-xs border rounded px-1.5 py-1"
                placeholder="URL"
              />
              <button onClick={() => removeNetwork(idx)} className="text-red-400 hover:text-red-600 text-xs px-1">x</button>
            </div>
          ))}
          {block.networks.length < SOCIAL_PLATFORMS.length && (
            <button onClick={addNetwork} className="text-xs text-indigo-600 hover:text-indigo-700">+ Add network</button>
          )}
        </div>
      </div>
      <SettingRow label="Align">
        <AlignButtons value={block.align} onChange={(v) => onChange({ align: v })} />
      </SettingRow>
      <SettingRow label="Icon Size">
        <input type="number" value={block.iconSize} onChange={(e) => onChange({ iconSize: parseInt(e.target.value) || 32 })} className="w-16 text-xs border rounded px-2 py-1.5" min={20} max={64} />
        <span className="text-xs text-gray-400">px</span>
      </SettingRow>
      <SettingRow label="Style">
        <select value={block.iconStyle} onChange={(e) => onChange({ iconStyle: e.target.value as 'color' | 'dark' | 'light' })} className="text-xs border rounded px-2 py-1.5">
          <option value="color">Color</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </SettingRow>
    </div>
  );
}

function HtmlBlockSettings({ block, onChange }: { block: HtmlBlock; onChange: (u: Partial<HtmlBlock>) => void }) {
  return (
    <div className="space-y-2.5">
      <div>
        <label className="text-xs text-gray-500 block mb-1">HTML Code</label>
        <textarea
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          className="w-full text-xs border rounded px-2 py-1.5 h-40 font-mono"
          placeholder="<div>Custom HTML...</div>"
        />
      </div>
      <PaddingSettings
        top={block.paddingTop} right={block.paddingRight} bottom={block.paddingBottom} left={block.paddingLeft}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}

// ============ SHARED SETTING COMPONENTS ============

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="color"
        value={value || '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-7 rounded border cursor-pointer"
        style={{ padding: 1 }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 text-xs border rounded px-2 py-1.5 font-mono"
        placeholder="#000000"
      />
    </div>
  );
}

function AlignButtons({ value, onChange }: { value: string; onChange: (v: 'left' | 'center' | 'right') => void }) {
  return (
    <div className="flex gap-0.5">
      {(['left', 'center', 'right'] as const).map(align => (
        <button
          key={align}
          onClick={() => onChange(align)}
          className={`px-2 py-1 text-xs rounded border ${value === align ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          {align === 'left' ? '⫷' : align === 'center' ? '☰' : '⫸'}
        </button>
      ))}
    </div>
  );
}

function PaddingSettings({ top, right, bottom, left, onChange }: { top: number; right: number; bottom: number; left: number; onChange: (p: Record<string, number>) => void }) {
  return (
    <div>
      <span className="text-xs text-gray-500 block mb-1">Padding</span>
      <div className="grid grid-cols-4 gap-1">
        <div className="text-center">
          <input type="number" value={top} onChange={(e) => onChange({ paddingTop: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1 py-1 text-center" min={0} />
          <span className="text-[10px] text-gray-400">Top</span>
        </div>
        <div className="text-center">
          <input type="number" value={right} onChange={(e) => onChange({ paddingRight: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1 py-1 text-center" min={0} />
          <span className="text-[10px] text-gray-400">Right</span>
        </div>
        <div className="text-center">
          <input type="number" value={bottom} onChange={(e) => onChange({ paddingBottom: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1 py-1 text-center" min={0} />
          <span className="text-[10px] text-gray-400">Bottom</span>
        </div>
        <div className="text-center">
          <input type="number" value={left} onChange={(e) => onChange({ paddingLeft: parseInt(e.target.value) || 0 })} className="w-full text-xs border rounded px-1 py-1 text-center" min={0} />
          <span className="text-[10px] text-gray-400">Left</span>
        </div>
      </div>
    </div>
  );
}

// ============ DROP ZONE ============

function DropZone({
  id,
  isActive,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  id: string;
  isActive: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      className={`transition-all ${isActive ? 'h-4 bg-indigo-100 border-2 border-dashed border-indigo-400' : 'h-1 hover:h-2'}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    />
  );
}

// ============ SECTION RENDERER ============

function SectionRenderer({
  section,
  globalStyles,
  selected,
  dragOverTarget,
  isFirst,
  isLast,
  onSelectBlock,
  onDragStartBlock,
  onDragOverBlock,
  onDragLeave,
  onDropOnColumn,
  onDeleteSection,
  onDuplicateSection,
  onMoveSectionUp,
  onMoveSectionDown,
  onDeleteBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onDuplicateBlock,
}: {
  section: EmailSection;
  globalStyles: EmailGlobalStyles;
  selected: SelectedBlock | null;
  dragOverTarget: string | null;
  isFirst: boolean;
  isLast: boolean;
  onSelectBlock: (columnId: string, blockId: string) => void;
  onDragStartBlock: (e: React.DragEvent, sectionId: string, columnId: string, blockId: string) => void;
  onDragOverBlock: (e: React.DragEvent, targetId: string) => void;
  onDragLeave: () => void;
  onDropOnColumn: (e: React.DragEvent, sectionId: string, columnId: string, insertIndex: number) => void;
  onDeleteSection: () => void;
  onDuplicateSection: () => void;
  onMoveSectionUp: () => void;
  onMoveSectionDown: () => void;
  onDeleteBlock: (sectionId: string, columnId: string, blockId: string) => void;
  onMoveBlockUp: (sectionId: string, columnId: string, blockId: string) => void;
  onMoveBlockDown: (sectionId: string, columnId: string, blockId: string) => void;
  onDuplicateBlock: (sectionId: string, columnId: string, blockId: string) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        backgroundColor: section.backgroundColor || undefined,
        padding: `${section.paddingTop}px ${section.paddingRight}px ${section.paddingBottom}px ${section.paddingLeft}px`,
      }}
    >
      {/* Section toolbar */}
      {isHovered && (
        <div className="absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 z-10">
          {!isFirst && (
            <button onClick={onMoveSectionUp} className="w-7 h-7 flex items-center justify-center bg-white border rounded shadow-sm text-gray-500 hover:text-gray-700 text-xs" title="Move up">
              ↑
            </button>
          )}
          <button onClick={onDuplicateSection} className="w-7 h-7 flex items-center justify-center bg-white border rounded shadow-sm text-gray-500 hover:text-gray-700 text-xs" title="Duplicate section">
            ⧉
          </button>
          <button onClick={onDeleteSection} className="w-7 h-7 flex items-center justify-center bg-white border rounded shadow-sm text-red-400 hover:text-red-600 text-xs" title="Delete section">
            ✕
          </button>
          {!isLast && (
            <button onClick={onMoveSectionDown} className="w-7 h-7 flex items-center justify-center bg-white border rounded shadow-sm text-gray-500 hover:text-gray-700 text-xs" title="Move down">
              ↓
            </button>
          )}
        </div>
      )}

      {/* Section outline on hover */}
      {isHovered && (
        <div className="absolute inset-0 border-2 border-indigo-200 rounded pointer-events-none z-[1]" />
      )}

      {/* Columns */}
      <div className="flex" style={{ gap: 0 }}>
        {section.columns.map((column) => (
          <div
            key={column.id}
            style={{ width: `${column.width}%` }}
            className="min-h-[40px]"
          >
            {/* Blocks in column */}
            {column.blocks.map((block, bIdx) => (
              <div key={block.id}>
                {/* Drop zone before block */}
                <DropZone
                  id={`before-${block.id}`}
                  isActive={dragOverTarget === `before-${block.id}`}
                  onDragOver={(e) => onDragOverBlock(e, `before-${block.id}`)}
                  onDragLeave={onDragLeave}
                  onDrop={(e) => onDropOnColumn(e, section.id, column.id, bIdx)}
                />

                {/* Block */}
                <BlockRenderer
                  block={block}
                  globalStyles={globalStyles}
                  isSelected={selected?.blockId === block.id}
                  isFirst={bIdx === 0}
                  isLast={bIdx === column.blocks.length - 1}
                  onClick={() => onSelectBlock(column.id, block.id)}
                  onDragStart={(e) => onDragStartBlock(e, section.id, column.id, block.id)}
                  onDelete={() => onDeleteBlock(section.id, column.id, block.id)}
                  onMoveUp={() => onMoveBlockUp(section.id, column.id, block.id)}
                  onMoveDown={() => onMoveBlockDown(section.id, column.id, block.id)}
                  onDuplicate={() => onDuplicateBlock(section.id, column.id, block.id)}
                />
              </div>
            ))}

            {/* Drop zone at end of column */}
            <DropZone
              id={`end-${column.id}`}
              isActive={dragOverTarget === `end-${column.id}`}
              onDragOver={(e) => onDragOverBlock(e, `end-${column.id}`)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDropOnColumn(e, section.id, column.id, column.blocks.length)}
            />

            {/* Empty column placeholder */}
            {column.blocks.length === 0 && (
              <div
                className={`border border-dashed rounded m-1 p-4 text-center text-xs text-gray-400 transition-colors ${
                  dragOverTarget === `end-${column.id}` ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300'
                }`}
                onDragOver={(e) => onDragOverBlock(e, `end-${column.id}`)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDropOnColumn(e, section.id, column.id, 0)}
              >
                Drop blocks here
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ BLOCK RENDERER (Canvas Preview) ============

function BlockRenderer({
  block,
  globalStyles,
  isSelected,
  isFirst,
  isLast,
  onClick,
  onDragStart,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: {
  block: EmailBlock;
  globalStyles: EmailGlobalStyles;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`relative cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-indigo-500 ring-offset-1 rounded' : isHovered ? 'ring-1 ring-indigo-200 rounded' : ''
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Block toolbar */}
      {(isSelected || isHovered) && (
        <div className="absolute -right-1 -top-1 flex gap-0.5 z-10">
          {!isFirst && (
            <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="w-6 h-6 flex items-center justify-center bg-white border rounded shadow-sm text-gray-400 hover:text-gray-600 text-[10px]">↑</button>
          )}
          {!isLast && (
            <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="w-6 h-6 flex items-center justify-center bg-white border rounded shadow-sm text-gray-400 hover:text-gray-600 text-[10px]">↓</button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDuplicate(); }} className="w-6 h-6 flex items-center justify-center bg-white border rounded shadow-sm text-gray-400 hover:text-gray-600 text-[10px]">⧉</button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-6 h-6 flex items-center justify-center bg-white border rounded shadow-sm text-red-400 hover:text-red-600 text-[10px]">✕</button>
        </div>
      )}

      {/* Block content preview */}
      <BlockPreview block={block} globalStyles={globalStyles} />
    </div>
  );
}

// ============ BLOCK PREVIEW (Visual representation) ============

function BlockPreview({ block, globalStyles }: { block: EmailBlock; globalStyles: EmailGlobalStyles }) {
  switch (block.type) {
    case 'text': {
      const color = block.color || globalStyles.textColor;
      return (
        <div
          style={{
            padding: `${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px`,
            textAlign: block.align,
            fontSize: block.fontSize,
            lineHeight: block.lineHeight,
            color,
            fontFamily: globalStyles.fontFamily,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
        />
      );
    }

    case 'heading': {
      const color = block.color || globalStyles.headingColor;
      const sizes: Record<number, number> = { 1: 28, 2: 22, 3: 18 };
      return (
        <div
          style={{
            padding: `${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px`,
            textAlign: block.align,
            fontSize: sizes[block.level],
            fontWeight: 700,
            color,
            fontFamily: globalStyles.fontFamily,
            lineHeight: 1.3,
          }}
        >
          {block.content}
        </div>
      );
    }

    case 'image': {
      if (!block.src) {
        return (
          <div style={{ padding: `${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px`, textAlign: block.align }}>
            <div style={{ background: '#f0f0f0', padding: '32px 16px', borderRadius: 4, textAlign: 'center', color: '#999', fontSize: 13, fontFamily: globalStyles.fontFamily }}>
              Click to add an image URL
            </div>
          </div>
        );
      }
      return (
        <div style={{ padding: `${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px`, textAlign: block.align }}>
          <img
            src={block.src}
            alt={block.alt}
            style={{ maxWidth: '100%', width: `${block.width}%`, height: 'auto', borderRadius: block.borderRadius, display: 'inline-block' }}
          />
        </div>
      );
    }

    case 'button': {
      const bg = block.backgroundColor || globalStyles.buttonBackgroundColor;
      const textColor = block.textColor || globalStyles.buttonTextColor;
      return (
        <div style={{ padding: `${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px`, textAlign: block.align }}>
          <span style={{
            display: block.fullWidth ? 'block' : 'inline-block',
            backgroundColor: bg,
            color: textColor,
            padding: '12px 28px',
            borderRadius: block.borderRadius,
            fontSize: block.fontSize,
            fontWeight: 600,
            fontFamily: globalStyles.fontFamily,
            textAlign: 'center',
            cursor: 'default',
          }}>
            {block.text}
          </span>
        </div>
      );
    }

    case 'divider':
      return (
        <div style={{ padding: `${block.paddingTop}px 20px ${block.paddingBottom}px 20px` }}>
          <hr style={{ border: 'none', borderTop: `${block.thickness}px ${block.style} ${block.color}`, width: `${block.width}%`, margin: '0 auto' }} />
        </div>
      );

    case 'spacer':
      return <div style={{ height: block.height, background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(99,102,241,0.05) 4px, rgba(99,102,241,0.05) 8px)' }} />;

    case 'social': {
      const SOCIAL_COLORS: Record<string, string> = {
        facebook: '#1877F2', twitter: '#000', instagram: '#E4405F', linkedin: '#0A66C2',
        youtube: '#FF0000', tiktok: '#000', pinterest: '#E60023', threads: '#000',
      };
      const SOCIAL_LETTERS: Record<string, string> = {
        facebook: 'f', twitter: 'X', instagram: 'ig', linkedin: 'in',
        youtube: 'YT', tiktok: 'TT', pinterest: 'P', threads: '@',
      };
      return (
        <div style={{ padding: `${block.paddingTop}px 20px ${block.paddingBottom}px 20px`, textAlign: block.align }}>
          <div style={{ display: 'inline-flex', gap: 12 }}>
            {block.networks.map((n, i) => {
              const color = block.iconStyle === 'dark' ? '#333' : block.iconStyle === 'light' ? '#fff' : (SOCIAL_COLORS[n.platform] || '#666');
              const bg = block.iconStyle === 'light' ? '#333' : 'transparent';
              return (
                <div
                  key={i}
                  style={{
                    width: block.iconSize,
                    height: block.iconSize,
                    borderRadius: '50%',
                    backgroundColor: bg,
                    border: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.round(block.iconSize * 0.35),
                    fontWeight: 700,
                    color,
                    fontFamily: globalStyles.fontFamily,
                  }}
                >
                  {SOCIAL_LETTERS[n.platform] || n.platform[0].toUpperCase()}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    case 'html':
      return (
        <div
          style={{ padding: `${block.paddingTop}px ${block.paddingRight}px ${block.paddingBottom}px ${block.paddingLeft}px` }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.content) }}
        />
      );
  }
}
