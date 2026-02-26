'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { HelpTip } from '@/components/ui/help-tip';
import { Sparkles, Save, CalendarDays } from 'lucide-react';
import { AutopilotCustomPrompt } from './autopilot-custom-prompt';

interface ProductItem {
  id: string;
  name: string;
}

interface AutopilotSettingsProps {
  botId: string;
  platforms: string[];
  defaults: {
    approvalMode: string;
    planDuration: number;
    contentMixMode: string;
    productRotation: boolean;
    productRotationMode: string;       // 'all' or 'selected'
    selectedProductIds: string[];       // IDs of products selected for rotation
    products: ProductItem[];           // All available products
    productCount: number;
    hasProducts: boolean;
    savedPrompt: string;
    mediaSource: string;
    schedulingMode: string;
    customStartDate: string;
    customEndDate: string;
    intensity: string;
  };
  saveAction: (formData: FormData) => Promise<void>;
  savePromptAction: (formData: FormData) => Promise<void>;
}

function toInputDate(iso: string): string {
  if (!iso) return '';
  return iso.split('T')[0];
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function AutopilotSettingsClient({
  botId, platforms, defaults, saveAction, savePromptAction,
}: AutopilotSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [contentMixMode, setContentMixMode] = useState(defaults.contentMixMode);
  const [savedPrompt, setSavedPrompt] = useState(defaults.savedPrompt);
  const [schedulingMode, setSchedulingMode] = useState(defaults.schedulingMode || 'DURATION');
  const [productRotationMode, setProductRotationMode] = useState(defaults.productRotationMode || 'all');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(defaults.selectedProductIds || []);

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

          {/* Plan Duration / Date Range */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Schedule Mode</Label>
              <HelpTip text="DURATION: Plan content for X days ahead from now. CUSTOM DATES: Choose exact start and end dates — posting starts on the start date." />
            </div>
            <select
              name="schedulingMode"
              value={schedulingMode}
              onChange={(e) => setSchedulingMode(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="DURATION">Duration (days ahead)</option>
              <option value="CUSTOM_DATES">Custom Date Range</option>
            </select>
          </div>

          {schedulingMode === 'DURATION' ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Plan Duration</Label>
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
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label>Start Date</Label>
                </div>
                <input
                  type="date"
                  name="customStartDate"
                  defaultValue={toInputDate(defaults.customStartDate) || todayStr()}
                  min={todayStr()}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label>End Date</Label>
                </div>
                <input
                  type="date"
                  name="customEndDate"
                  defaultValue={toInputDate(defaults.customEndDate) || ''}
                  min={todayStr()}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}

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
        </div>

        {/* Second row */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Post Intensity */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Post Intensity</Label>
              <HelpTip text="Controls how many posts per day the autopilot generates. Recommended follows platform best practices. Higher intensity = more posts = more credits used." />
            </div>
            <select
              name="intensity"
              defaultValue={defaults.intensity || 'recommended'}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="low">Low (~1-2 posts/day)</option>
              <option value="recommended">Recommended (Optimal)</option>
              <option value="high">High (~4-6 posts/day)</option>
              <option value="extreme">Extreme (~8-12 posts/day)</option>
            </select>
            <p className="text-[10px] text-muted-foreground">
              {defaults.intensity === 'low' && 'Minimal posting — best for niche audiences or premium content'}
              {(defaults.intensity === 'recommended' || !defaults.intensity) && 'Balanced — follows platform algorithm research for best reach'}
              {defaults.intensity === 'high' && 'Aggressive — more content visibility, higher credit usage'}
              {defaults.intensity === 'extreme' && 'Maximum output — high credit cost, risk of audience fatigue'}
            </p>
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
            <div className="flex items-center gap-1.5">
              <Label>Product Rotation</Label>
              <HelpTip text="Enable to auto-promote your products in autopilot posts. Choose 'Rotate All' to cycle through every product, or 'Select Products' to pick specific ones." />
            </div>
            <label className="flex items-center gap-2 h-10 cursor-pointer">
              <input
                type="checkbox"
                name="productRotation"
                defaultChecked={defaults.productRotation}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-sm">Auto-promote products</span>
            </label>
            {defaults.hasProducts ? (
              <p className="text-xs text-muted-foreground">
                {defaults.productCount} product(s) available
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">No products added yet</p>
            )}
          </div>
        </div>

        {/* Product Selection — only shown when rotation is enabled and products exist */}
        {defaults.hasProducts && (
          <div className="space-y-3 rounded-md border p-3 bg-muted/20">
            <div className="flex items-center gap-3">
              <Label className="text-xs font-medium">Promote</Label>
              <select
                name="productRotationMode"
                value={productRotationMode}
                onChange={(e) => setProductRotationMode(e.target.value)}
                className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-xs"
              >
                <option value="all">Rotate All Products ({defaults.productCount})</option>
                <option value="selected">Select Specific Products</option>
              </select>
            </div>

            {productRotationMode === 'selected' && (
              <div className="space-y-1.5">
                {defaults.products.map(product => {
                  const isChecked = selectedProductIds.includes(product.id);
                  return (
                    <label key={product.id} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedProductIds(prev =>
                            isChecked
                              ? prev.filter(pid => pid !== product.id)
                              : [...prev, product.id]
                          );
                        }}
                        className="h-3.5 w-3.5 rounded border-input"
                      />
                      <span className="text-sm group-hover:text-primary transition-colors">{product.name}</span>
                    </label>
                  );
                })}
                {selectedProductIds.length === 0 && (
                  <p className="text-[10px] text-amber-600">Select at least one product for promotion</p>
                )}
                {selectedProductIds.length > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {selectedProductIds.length} of {defaults.productCount} product(s) selected for rotation
                  </p>
                )}
              </div>
            )}

            {/* Hidden inputs to submit product selection */}
            <input type="hidden" name="productRotationMode" value={productRotationMode} />
            <input type="hidden" name="selectedProductIds" value={JSON.stringify(selectedProductIds)} />
          </div>
        )}

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
