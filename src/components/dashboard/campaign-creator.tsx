'use client';

import { useState, useRef } from 'react';
import EmailDesigner from './email-designer';
import type { EmailDesign } from '@/lib/email-designer-types';

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
  const [showSettings, setShowSettings] = useState(false);
  const [editingStep, setEditingStep] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const senderDone = true; // always have email account
  const recipientsDone = !!state.listId;
  const subjectDone = !!state.subject;
  const designDone = !!state.htmlContent;
  const allDone = recipientsDone && subjectDone && designDone && !!state.name;

  function handleDesignerSave(html: string, text: string, json: string) {
    setState(s => ({ ...s, htmlContent: html, textContent: text, designJson: json }));
    setShowDesigner(false);
  }

  function handleDesignerClose() {
    setShowDesigner(false);
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
        onClose={handleDesignerClose}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <a
            href={`/dashboard/bots/${botId}/email?tab=campaigns`}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <span className="text-lg">&larr;</span>
          </a>
          <div>
            <div className="flex items-center gap-2">
              {state.name ? (
                <h1 className="text-xl font-semibold">{state.name}</h1>
              ) : (
                <input
                  type="text"
                  value={state.name}
                  onChange={(e) => setState(s => ({ ...s, name: e.target.value }))}
                  placeholder="Campaign name..."
                  className="text-xl font-semibold border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 outline-none bg-transparent px-0 py-0.5"
                  autoFocus
                />
              )}
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Draft</span>
              {state.name && (
                <button
                  onClick={() => setState(s => ({ ...s, name: '' }))}
                  className="text-xs text-gray-400 hover:text-gray-600"
                  title="Edit name"
                >
                  ✎
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => formRef.current?.requestSubmit()}
            disabled={!allDone}
            className={`px-4 py-2 text-sm font-medium rounded-lg ${
              allDone
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Schedule
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-800 border border-red-200 rounded-lg p-3 text-sm mb-6">
          {error}
        </div>
      )}

      {/* Hidden form for submission */}
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
            <button
              onClick={() => setEditingStep(null)}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </ChecklistStep>

        <StepDivider />

        {/* Step 2: Recipients */}
        <ChecklistStep
          icon={<CheckIcon done={recipientsDone} />}
          title="Recipients"
          subtitle={
            recipientsDone
              ? `${lists.find(l => l.id === state.listId)?.name} (${lists.find(l => l.id === state.listId)?._count.contacts} contacts)`
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
                onChange={(e) => setState(s => ({ ...s, listId: e.target.value }))}
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
                <a href={`/dashboard/bots/${botId}/email?tab=contacts`} className="text-indigo-600 hover:underline">
                  Create one first
                </a>
              </p>
            )}
            <button
              onClick={() => setEditingStep(null)}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Done
            </button>
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
              <p className="text-xs text-gray-400 mt-1">
                {state.subject.length}/60 characters. Keep it concise for best open rates.
              </p>
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
              <label className="text-sm text-gray-600 block mb-1">Subject Line B for A/B Testing <span className="text-gray-400">(optional)</span></label>
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
                    onChange={(e) => setState(s => ({ ...s, abTestPercent: parseInt(e.target.value) }))}
                    className="border rounded-lg px-3 py-1.5 text-sm"
                  >
                    <option value={10}>10% (5% per variant)</option>
                    <option value={20}>20% (10% per variant)</option>
                    <option value={30}>30% (15% per variant)</option>
                    <option value={50}>50% (25% per variant)</option>
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={() => setEditingStep(null)}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </ChecklistStep>

        <StepDivider />

        {/* Step 4: Design */}
        <ChecklistStep
          icon={<CheckIcon done={designDone} />}
          title="Design"
          subtitle={designDone ? 'Email design ready' : 'Create your email content.'}
          actionLabel={designDone ? 'Edit design' : 'Start designing'}
          onToggleEdit={() => setShowDesigner(true)}
        >
          {null}
        </ChecklistStep>

        <StepDivider />

        {/* Step 5: Additional Settings */}
        <ChecklistStep
          icon={<span className="w-6 h-6 rounded-full border-2 border-gray-200 flex items-center justify-center text-gray-400 text-xs">⚙</span>}
          title="Additional settings"
          subtitle={state.scheduledAt ? `Scheduled for ${new Date(state.scheduledAt).toLocaleString()}` : 'Schedule sending, configure options'}
          actionLabel="Edit settings"
          isEditing={editingStep === 'settings' || showSettings}
          onToggleEdit={() => {
            setShowSettings(!showSettings);
            setEditingStep(showSettings ? null : 'settings');
          }}
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
              <p className="text-xs text-gray-400 mt-1">
                Leave empty to save as draft. You can send it manually later.
              </p>
            </div>
            <button
              onClick={() => { setShowSettings(false); setEditingStep(null); }}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              Done
            </button>
          </div>
        </ChecklistStep>
      </div>

      {/* Action Bar */}
      <div className="mt-6 flex items-center justify-between">
        <a
          href={`/dashboard/bots/${botId}/email?tab=campaigns`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </a>
        <div className="flex items-center gap-3">
          {!allDone && (
            <p className="text-sm text-gray-400">
              Complete all steps to save your campaign
            </p>
          )}
          <button
            onClick={() => formRef.current?.requestSubmit()}
            disabled={!allDone}
            className={`px-5 py-2.5 text-sm font-medium rounded-lg flex items-center gap-2 ${
              allDone
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Save Campaign
          </button>
        </div>
      </div>

      {/* Merge Tags Info */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-1">Personalization Tags</h3>
        <p className="text-xs text-blue-700">
          Use these tags in your email design for personalization:{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{firstName}}'}</code>{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{lastName}}'}</code>{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{email}}'}</code>{' '}
          <code className="bg-blue-100 px-1.5 py-0.5 rounded text-blue-900">{'{{brandName}}'}</code>.
          Unsubscribe link is added automatically.
        </p>
      </div>
    </div>
  );
}

// ============ CHECKLIST STEP ============

function ChecklistStep({
  icon,
  title,
  subtitle,
  actionLabel,
  actionHref,
  isEditing,
  onToggleEdit,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  actionLabel: string;
  actionHref?: string;
  isEditing?: boolean;
  onToggleEdit: () => void;
  children: React.ReactNode;
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
        <div>
          {actionHref ? (
            <a
              href={actionHref}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              {actionLabel}
            </a>
          ) : (
            <button
              onClick={onToggleEdit}
              className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 text-gray-700 font-medium"
            >
              {actionLabel}
            </button>
          )}
        </div>
      </div>

      {/* Expanded editing area */}
      {isEditing && children && (
        <div className="mt-4 ml-9 pl-3 border-l-2 border-indigo-100">
          {children}
        </div>
      )}
    </div>
  );
}

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
  );
}

function StepDivider() {
  return <div className="border-t border-gray-100 mx-6" />;
}
