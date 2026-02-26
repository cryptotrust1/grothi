'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { Shield, Sparkles, MessageSquare, Save, Loader2 } from 'lucide-react';
import { AutopilotCustomPrompt } from './autopilot-custom-prompt';

interface AutopilotSettingsProps {
  botId: string;
  platforms: string[];
  defaults: {
    approvalMode: string;
    planDuration: number;
    contentMixMode: string;
    productRotation: boolean;
    productCount: number;
    hasProducts: boolean;
    savedPrompt: string;
    mediaSource: string;
  };
  saveAction: (formData: FormData) => Promise<void>;
  savePromptAction: (formData: FormData) => Promise<void>;
}

export function AutopilotSettingsClient({
  botId, platforms, defaults, saveAction, savePromptAction,
}: AutopilotSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contentMixMode, setContentMixMode] = useState(defaults.contentMixMode);
  const [savedPrompt, setSavedPrompt] = useState(defaults.savedPrompt);

  const handleSavePrompt = useCallback((prompt: string) => {
    setSavedPrompt(prompt);
    const fd = new FormData();
    fd.set('prompt', prompt);
    startTransition(async () => {
      await savePromptAction(fd);
      router.refresh();
    });
  }, [savePromptAction, router]);

  return (
    <div className="space-y-4">
      <form action={saveAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Approval Mode */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Approval Mode</Label>
              <HelpTip text="REVIEW ALL: Every autopilot post is created as a draft for your review before scheduling. AUTO APPROVE: Posts are automatically scheduled for publishing without manual review." />
            </div>
            <select
              name="approvalMode"
              defaultValue={defaults.approvalMode}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="REVIEW_ALL">Review All Posts</option>
              <option value="AUTO_APPROVE">Auto-Approve</option>
            </select>
          </div>

          {/* Plan Duration */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Plan Duration</Label>
              <HelpTip text="How far ahead the autopilot plans content. 3-7 days recommended. Longer plans generate more posts and cost more credits." />
            </div>
            <select
              name="planDuration"
              defaultValue={defaults.planDuration}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="3">3 Days</option>
              <option value="5">5 Days</option>
              <option value="7">7 Days</option>
              <option value="14">14 Days</option>
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
            </select>
          </div>

          {/* Content Mix */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Content Mix</Label>
              <HelpTip text="AI RECOMMENDED: Uses platform algorithm research. CUSTOM (from Strategy): Uses your Content Strategy settings. CUSTOM PROMPT: Write exact instructions via AI chat — overrides all other settings." />
            </div>
            <select
              name="contentMixMode"
              value={contentMixMode}
              onChange={(e) => setContentMixMode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="AI_RECOMMENDED">AI Recommended</option>
              <option value="CUSTOM">Custom (from Strategy)</option>
              <option value="CUSTOM_PROMPT">Custom Prompt (AI Chat)</option>
            </select>
          </div>

          {/* Media Source */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Media Source</Label>
              <HelpTip text="LIBRARY ONLY: Use only media you uploaded. AI GENERATED: AI creates new images for each post. AI MIX: AI decides — uses your library when suitable, generates new when needed." />
            </div>
            <select
              name="mediaSource"
              defaultValue={defaults.mediaSource}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="LIBRARY_ONLY">My Media Library</option>
              <option value="AI_GENERATED">AI Generated Only</option>
              <option value="AI_MIX">AI Mix (Recommended)</option>
            </select>
          </div>

          {/* Product Rotation */}
          <div className="space-y-2">
            <Label>Product Rotation</Label>
            <label className="flex items-center gap-2 h-10 cursor-pointer">
              <input
                type="checkbox"
                name="productRotation"
                defaultChecked={defaults.productRotation}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Auto-promote products</span>
            </label>
            <p className="text-xs text-muted-foreground">
              {defaults.hasProducts
                ? `Rotate ${defaults.productCount} product(s) in promo posts`
                : 'No products added yet'}
            </p>
          </div>
        </div>

        {/* Hidden field for custom prompt */}
        {contentMixMode === 'CUSTOM_PROMPT' && (
          <input type="hidden" name="customPrompt" value={savedPrompt} />
        )}

        <Button type="submit" size="sm">
          <Save className="h-3.5 w-3.5 mr-1.5" /> Save Settings
        </Button>
      </form>

      {/* Custom Prompt AI Chat — appears immediately when selected */}
      {contentMixMode === 'CUSTOM_PROMPT' && (
        <div className="rounded-lg border bg-violet-50/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <span className="font-semibold text-sm">Custom Autopilot Instructions</span>
            {savedPrompt && (
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 ml-auto">
                Prompt saved
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Tell the AI exactly what content to create. These instructions override strategy and brand settings.
          </p>
          <AutopilotCustomPrompt
            botId={botId}
            platforms={platforms}
            savedPrompt={savedPrompt}
            onSavePrompt={handleSavePrompt}
          />
        </div>
      )}
    </div>
  );
}
