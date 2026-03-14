'use client';

import { useState, useRef } from 'react';
import EmailDesigner from './email-designer';
import type { EmailDesign } from '@/lib/email-designer-types';
import { EMAIL_STARTER_TEMPLATES, TEMPLATE_CATEGORIES } from '@/lib/email-designer-templates';
import type { TemplateCategory } from '@/lib/email-designer-templates';

// ============ TYPES ============

interface EmailList {
  id: string;
  name: string;
  _count: { contacts: number };
}

interface EmailAccountInfo {
  fromName: string | null;
  fromEmail: string;
}

interface CampaignCreatorProps {
  botId: string;
  brandName: string;
  lists: EmailList[];
  emailAccount: EmailAccountInfo;
  createCampaignAction: (formData: FormData) => Promise<void>;
  error?: string;
}

interface StepState {
  fromName: string;
  listId: string;
  subject: string;
  preheader: string;
  subjectB: string;
  abTestPercent: number;
  htmlContent: string;
  textContent: string;
  designJson: string;
  scheduledAt: string;
  name: string;
}

// ============ COMPONENT ============

export default function CampaignCreator({
  botId,
  brandName,
  lists,
  emailAccount,
  createCampaignAction,
  error,
}: CampaignCreatorProps) {
  const [state, setState] = useState<StepState>({
    fromName: emailAccount.fromName || '',
    listId: '',
    subject: '',
    preheader: '',
    subjectB: '',
    abTestPercent: 20,
    htmlContent: '',
    textContent: '',
    designJson: '',
    scheduledAt: '',
    name: '',
  });
  const [showDesigner, setShowDesigner] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const senderDone = true;
  const recipientsDone = !!state.listId;
  const subjectDone = !!state.subject;
  const designDone = !!state.htmlContent;
  const allDone = recipientsDone && subjectDone && designDone && !!state.name;

  function handleDesignerSave(html: string, text: string, json: string) {
    setState(s => ({ ...s, htmlContent: html, textContent: text, designJson: json }));
    setShowDesigner(false);
  }

  function openDesignerWithTemplate(template: EmailDesign) {
    setState(s => ({ ...s, designJson: JSON.stringify(template) }));
    setShowTemplatePicker(false);
    setShowDesigner(true);
  }

  function openDesignerBlank() {
    setShowTemplatePicker(false);
    setShowDesigner(true);
  }

  function getInitialDesign(): EmailDesign | undefined {
    if (state.designJson) {
      try {
        return JSON.parse(state.designJson);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  // ============ RENDER ============

  if (showDesigner) {
    return (
      <EmailDesigner
        initialDesign={getInitialDesign()}
        brandName={brandName}
        onSave={handleDesignerSave}
        onClose={() => setShowDesigner(false)}
      />
    );
  }

  // Template Picker overlay
  if (showTemplatePicker) {
    return <TemplatePicker
      onSelectTemplate={openDesignerWithTemplate}
      onSelectBlank={openDesignerBlank}
      onBack={() => setShowTemplatePicker(false)}
    />;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header - Campaign name is always an editable input */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <a
            href={`/dashboard/bots/${botId}/email?tab=campaigns`}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </a>
          <input
            type="text"
            value={state.name}
            onChange={(e) => setState(s => ({ ...s, name: e.target.value }))}
            placeholder="Campaign name..."
            className="text-xl font-semibold border-0 border-b-2 border-dashed border-gray-200 focus:border-indigo-500 outline-none bg-transparent px-1 py-1 min-w-[200px] max-w-[400px] placeholder:text-gray-300"
          />
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">Draft</span>
        </div>
        <button
          onClick={() => formRef.current?.requestSubmit()}
          disabled={!allDone}
          className={`px-5 py-2 text-sm font-medium rounded-lg shrink-0 ${
            allDone
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Schedule
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Hidden form for server action submission */}
      <form ref={formRef} action={createCampaignAction} className="hidden">
        <input type="hidden" name="botId" value={botId} />
        <input type="hidden" name="name" value={state.name} />
        <input type="hidden" name="subject" value={state.subject} />
        <input type="hidden" name="preheader" value={state.preheader} />
        <input type="hidden" name="fromName" value={state.fromName} />
        <input type="hidden" name="listId" value={state.listId} />
        <input type="hidden" name="htmlContent" value={state.htmlContent} />
        <input type="hidden" name="textContent" value={state.textContent} />
        <input type="hidden" name="designJson" value={state.designJson} />
        <input type="hidden" name="subjectB" value={state.subjectB} />
        <input type="hidden" name="abTestPercent" value={state.abTestPercent.toString()} />
        <input type="hidden" name="scheduledAt" value={state.scheduledAt} />
      </form>

      {/* Brevo-style Checklist */}
      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
        {/* Step 1: Sender */}
        <ChecklistStep
          icon={<CheckIcon done={senderDone} />}
          title="Sender"
          subtitle={`${emailAccount.fromName || brandName} · ${emailAccount.fromEmail}`}
          actionLabel="Manage sender"
          actionHref={`/dashboard/bots/${botId}/email?tab=setup`}
          isEditing={editingStep === 'sender'}
          onToggleEdit={() => setEditingStep(editingStep === 'sender' ? null : 'sender')}
        >
          <div className="space-y-3 max-w-md">
            <div>
              <label className="text-sm text-gray-600 block mb-1">From Name</label>
              <input
                type="text"
                value={state.fromName}
                onChange={(e) => setState(s => ({ ...s, fromName: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder={brandName}
              />
            </div>
            <div className="text-sm text-gray-500">
              Sending from: <strong>{emailAccount.fromEmail}</strong>
            </div>
            <button onClick={() => setEditingStep(null)} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Done</button>
          </div>
        </ChecklistStep>

        <StepDivider />

        {/* Step 2: Recipients */}
        <ChecklistStep
          icon={<CheckIcon done={recipientsDone} />}
          title="Recipients"
          subtitle={
            recipientsDone
              ? `${lists.find(l => l.id === state.listId)?.name || ''} (${lists.find(l => l.id === state.listId)?._count.contacts || 0} contacts)`
              : 'The people who receive your campaign'
          }
          actionLabel={recipientsDone ? 'Change' : 'Add recipients'}
          isEditing={editingStep === 'recipients'}
          onToggleEdit={() => setEditingStep(editingStep === 'recipients' ? null : 'recipients')}
        >
          <div className="space-y-3 max-w-md">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Contact List</label>
              <select
                value={state.listId}
                onChange={(e) => { setState(s => ({ ...s, listId: e.target.value })); setEditingStep(null); }}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select a contact list</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list._count.contacts} contacts)
                  </option>
                ))}
              </select>
            </div>
            {lists.length === 0 && (
              <p className="text-sm text-gray-500">
                No contact lists yet.{' '}
                <a href={`/dashboard/bots/${botId}/email?tab=contacts`} className="text-indigo-600 hover:underline">Create one first</a>
              </p>
            )}
          </div>
        </ChecklistStep>

        <StepDivider />

        {/* Step 3: Subject */}
        <ChecklistStep
          icon={<CheckIcon done={subjectDone} />}
          title="Subject"
          subtitle={subjectDone ? state.subject : 'Add a subject line for this campaign.'}
          actionLabel={subjectDone ? 'Edit' : 'Add subject'}
          isEditing={editingStep === 'subject'}
          onToggleEdit={() => setEditingStep(editingStep === 'subject' ? null : 'subject')}
        >
          <div className="space-y-3 max-w-lg">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Subject Line</label>
              <input
                type="text"
                value={state.subject}
                onChange={(e) => setState(s => ({ ...s, subject: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Your weekly update is here"
                maxLength={60}
              />
              <p className="text-xs text-gray-400 mt-1">{state.subject.length}/60 characters</p>
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Preheader Text <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={state.preheader}
                onChange={(e) => setState(s => ({ ...s, preheader: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="Brief preview text shown after subject line"
              />
            </div>

            {/* A/B Testing */}
            <div className="pt-2 border-t">
              <label className="text-sm text-gray-600 block mb-1">A/B Test Subject <span className="text-gray-400">(optional)</span></label>
              <input
                type="text"
                value={state.subjectB}
                onChange={(e) => setState(s => ({ ...s, subjectB: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Don't miss our latest update!"
              />
              {state.subjectB && (
                <div className="mt-2">
                  <label className="text-xs text-gray-500 block mb-1">Test sample size</label>
                  <select
                    value={state.abTestPercent}
                    onChange={(e) => setState(s => ({ ...s, abTestPercent: parseInt(e.target.value, 10) || 20 }))}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value={10}>10%</option>
                    <option value={20}>20%</option>
                    <option value={30}>30%</option>
                    <option value={50}>50%</option>
                  </select>
                </div>
              )}
            </div>

            <button onClick={() => setEditingStep(null)} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Done</button>
          </div>
        </ChecklistStep>

        <StepDivider />

        {/* Step 4: Design */}
        <ChecklistStep
          icon={<CheckIcon done={designDone} />}
          title="Design"
          subtitle={designDone ? 'Email design ready' : 'Create your email content.'}
          actionLabel={designDone ? 'Edit design' : 'Start designing'}
          onToggleEdit={() => {
            if (designDone) {
              setShowDesigner(true);
            } else {
              setShowTemplatePicker(true);
            }
          }}
        >
          {null}
        </ChecklistStep>

        <StepDivider />

        {/* Step 5: Additional Settings */}
        <ChecklistStep
          icon={<SettingsIcon />}
          title="Additional settings"
          subtitle={state.scheduledAt ? `Scheduled: ${new Date(state.scheduledAt).toLocaleString()}` : 'Schedule sending, configure options'}
          actionLabel="Edit settings"
          isEditing={editingStep === 'settings'}
          onToggleEdit={() => setEditingStep(editingStep === 'settings' ? null : 'settings')}
        >
          <div className="space-y-3 max-w-md">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Schedule Send <span className="text-gray-400">(optional)</span></label>
              <input
                type="datetime-local"
                value={state.scheduledAt}
                onChange={(e) => setState(s => ({ ...s, scheduledAt: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-gray-400 mt-1">Leave empty to save as draft.</p>
            </div>
            <button onClick={() => setEditingStep(null)} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Done</button>
          </div>
        </ChecklistStep>
      </div>

      {/* Save button */}
      <div className="mt-6 flex items-center justify-between">
        <a href={`/dashboard/bots/${botId}/email?tab=campaigns`} className="text-sm text-gray-500 hover:text-gray-700">Cancel</a>
        <div className="flex items-center gap-3">
          {!allDone && <p className="text-sm text-gray-400">Complete all steps to save</p>}
          <button
            onClick={() => formRef.current?.requestSubmit()}
            disabled={!allDone}
            className={`px-5 py-2.5 text-sm font-medium rounded-lg ${
              allDone ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Save Campaign
          </button>
        </div>
      </div>

      {/* Merge Tags */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-1">Personalization Tags</h3>
        <p className="text-xs text-blue-700">
          Use in your design:{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{firstName}}'}</code>{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{lastName}}'}</code>{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{email}}'}</code>{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{brandName}}'}</code>.
          Unsubscribe link added automatically.
        </p>
      </div>
    </div>
  );
}

// ============ TEMPLATE PICKER ============

function TemplatePicker({
  onSelectTemplate,
  onSelectBlank,
  onBack,
}: {
  onSelectTemplate: (design: EmailDesign) => void;
  onSelectBlank: () => void;
  onBack: () => void;
}) {
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all');

  const filteredTemplates = activeCategory === 'all'
    ? EMAIL_STARTER_TEMPLATES
    : EMAIL_STARTER_TEMPLATES.filter(t => t.category === activeCategory);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Back
          </button>
          <h1 className="text-xl font-semibold text-gray-900">Choose a Template</h1>
        </div>
        <span className="text-sm text-gray-400">{EMAIL_STARTER_TEMPLATES.length} templates</span>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 -mx-1 px-1 scrollbar-hide">
        {TEMPLATE_CATEGORIES.map(({ id, label }) => {
          const count = id === 'all'
            ? EMAIL_STARTER_TEMPLATES.length
            : EMAIL_STARTER_TEMPLATES.filter(t => t.category === id).length;
          if (id !== 'all' && count === 0) return null;
          return (
            <button
              key={id}
              onClick={() => setActiveCategory(id)}
              className={`px-3.5 py-1.5 text-sm rounded-full whitespace-nowrap transition-all shrink-0 ${
                activeCategory === id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label} <span className={`${activeCategory === id ? 'text-indigo-200' : 'text-gray-400'}`}>({count})</span>
            </button>
          );
        })}
      </div>

      {/* Blank design option */}
      <button
        onClick={onSelectBlank}
        className="w-full text-left border-2 border-dashed border-gray-300 rounded-xl p-5 mb-5 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gray-100 group-hover:bg-indigo-100 flex items-center justify-center text-2xl text-gray-400 group-hover:text-indigo-500 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          </div>
          <div>
            <p className="font-semibold text-gray-900">Start from scratch</p>
            <p className="text-sm text-gray-500">Build your email with the drag-and-drop designer</p>
          </div>
        </div>
      </button>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelectTemplate(template.design())}
            className="text-left bg-white border rounded-xl overflow-hidden hover:shadow-lg hover:border-indigo-300 transition-all group relative"
          >
            {/* Template preview area */}
            <div
              className="h-56 border-b flex items-center justify-center overflow-hidden relative"
              style={{ backgroundColor: template.design().globalStyles.backgroundColor || '#f4f4f7' }}
            >
              <div
                className="w-[200px] transform scale-[0.32] origin-top pointer-events-none"
                style={{ height: 550 }}
              >
                <TemplateMiniPreview design={template.design()} />
              </div>
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-lg">
                  Use Template
                </span>
              </div>
            </div>
            {/* Template info */}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: template.color }}
                />
                <p className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">{template.name}</p>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{template.description}</p>
              <span
                className="inline-block mt-2 text-xs px-2.5 py-0.5 rounded-full font-medium"
                style={{
                  backgroundColor: `${template.color}15`,
                  color: template.color,
                }}
              >
                {TEMPLATE_CATEGORIES.find(c => c.id === template.category)?.label || template.category}
              </span>
            </div>
          </button>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p>No templates in this category yet.</p>
        </div>
      )}
    </div>
  );
}

// ============ SUB COMPONENTS ============

function TemplateMiniPreview({ design }: { design: EmailDesign }) {
  return (
    <div style={{ backgroundColor: design.globalStyles.contentBackgroundColor, fontFamily: design.globalStyles.fontFamily, fontSize: 14, overflow: 'hidden' }}>
      {design.sections.map((section) => (
        <div key={section.id} style={{ backgroundColor: section.backgroundColor || undefined, padding: `${section.paddingTop}px ${section.paddingRight}px ${section.paddingBottom}px ${section.paddingLeft}px` }}>
          {section.columns.map((column) => (
            <div key={column.id}>
              {column.blocks.map((block) => (
                <div key={block.id} style={{ padding: '2px 0' }}>
                  {block.type === 'heading' && <div style={{ fontSize: 16, fontWeight: 700, color: block.color || design.globalStyles.headingColor, textAlign: block.align, padding: '4px 8px' }}>{block.content}</div>}
                  {block.type === 'text' && <div style={{ fontSize: 10, color: design.globalStyles.textColor, padding: '2px 8px', lineHeight: 1.3 }} dangerouslySetInnerHTML={{ __html: block.content.substring(0, 100) }} />}
                  {block.type === 'button' && <div style={{ textAlign: block.align, padding: '4px 8px' }}><span style={{ display: 'inline-block', backgroundColor: block.backgroundColor || design.globalStyles.buttonBackgroundColor, color: block.textColor || design.globalStyles.buttonTextColor, padding: '4px 12px', borderRadius: block.borderRadius, fontSize: 9, fontWeight: 600 }}>{block.text}</span></div>}
                  {block.type === 'divider' && <hr style={{ border: 'none', borderTop: `1px solid ${block.color}`, margin: '4px 8px' }} />}
                  {block.type === 'spacer' && <div style={{ height: Math.min(block.height / 3, 10) }} />}
                  {block.type === 'image' && <div style={{ background: '#eee', height: 40, margin: '4px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#999' }}>IMG</div>}
                  {block.type === 'social' && <div style={{ textAlign: 'center', fontSize: 8, color: '#999', padding: '4px' }}>Social Links</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChecklistStep({ icon, title, subtitle, actionLabel, actionHref, isEditing, onToggleEdit, children }: {
  icon: React.ReactNode; title: string; subtitle: string; actionLabel: string;
  actionHref?: string; isEditing?: boolean; onToggleEdit: () => void; children: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{icon}</div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        {actionHref ? (
          <a href={actionHref} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-700 font-medium shrink-0">{actionLabel}</a>
        ) : (
          <button onClick={onToggleEdit} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-700 font-medium shrink-0">{actionLabel}</button>
        )}
      </div>
      {isEditing && children && (
        <div className="mt-4 ml-9 pl-3 border-l-2 border-indigo-100">{children}</div>
      )}
    </div>
  );
}

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      </div>
    );
  }
  return <div className="w-6 h-6 rounded-full border-2 border-gray-300" />;
}

function SettingsIcon() {
  return (
    <div className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
        <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    </div>
  );
}

function StepDivider() {
  return <div className="border-t border-gray-100 mx-6" />;
}
