'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsUp, ThumbsDown, RotateCcw, Loader2, CheckCircle2 } from 'lucide-react';

interface ArmInfo {
  armKey: string;
  label: string;
  reward: number;
  pulls: number;
  platform: string;
  dimension: string;
}

/** Minimum pulls to consider a strategy "proven" */
const PROVEN_MIN_PULLS = 10;
/** Minimum reward above 0 to be "proven" */
const PROVEN_MIN_REWARD = 0.1;

interface LearningControlsProps {
  botId: string;
  /** Arms organized by dimension */
  armsByDimension: Record<string, ArmInfo[]>;
  /** Dimension display labels */
  dimensionLabels: Record<string, string>;
}

type FeedbackState = Record<string, 'boosted' | 'penalized' | undefined>;

export function LearningControls({ botId, armsByDimension, dimensionLabels }: LearningControlsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [message, setMessage] = useState<string | null>(null);

  const doAction = async (
    action: string,
    params: Record<string, string>,
    feedbackKey?: string,
    feedbackType?: 'boosted' | 'penalized'
  ) => {
    const key = feedbackKey || `${action}-${params.dimension || ''}-${params.armKey || ''}`;
    setLoading(key);
    setMessage(null);

    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/rl-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        if (feedbackKey && feedbackType) {
          setFeedback(prev => ({ ...prev, [feedbackKey]: feedbackType }));
        }
        if (action.startsWith('reset')) {
          // Reload page to reflect reset
          window.location.reload();
        }
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const dimensions = Object.keys(armsByDimension);
  if (dimensions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No learning data yet. Create posts to start training the AI.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`text-sm p-3 rounded-lg border ${message.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {message}
        </div>
      )}

      {dimensions.map(dim => {
        const arms = armsByDimension[dim];
        if (!arms || arms.length === 0) return null;

        return (
          <div key={dim} className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{dimensionLabels[dim] || dim}</h4>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                disabled={loading !== null}
                onClick={() => doAction('reset_dimension', {
                  platform: arms[0].platform,
                  dimension: dim,
                })}
              >
                {loading === `reset_dimension-${dim}-` ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="h-3 w-3 mr-1" />
                )}
                Reset
              </Button>
            </div>

            <div className="space-y-2">
              {arms.slice(0, 6).map((arm, armIdx) => {
                const feedbackKey = `${dim}-${arm.platform}-${arm.armKey}`;
                const currentFeedback = feedback[feedbackKey];
                const isProven = arm.pulls >= PROVEN_MIN_PULLS && arm.reward >= PROVEN_MIN_REWARD;
                const isBest = armIdx === 0 && arm.pulls >= 3;
                const isStable = currentFeedback === 'boosted' || (isProven && arm.pulls >= 20);

                return (
                  <div
                    key={feedbackKey}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border ${
                      isStable ? 'bg-green-50/50 border-green-200' : isProven ? 'bg-blue-50/30 border-blue-100' : 'bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                      <span className="text-sm font-medium truncate">{arm.label}</span>
                      {isStable && (
                        <Badge className="bg-green-100 text-green-800 text-[10px] gap-0.5 shrink-0">
                          <CheckCircle2 className="h-2.5 w-2.5" /> Stable
                        </Badge>
                      )}
                      {isBest && !isStable && (
                        <Badge className="bg-indigo-100 text-indigo-800 text-[10px] shrink-0">
                          Best
                        </Badge>
                      )}
                      {isProven && !isStable && (
                        <Badge className="bg-blue-100 text-blue-800 text-[10px] shrink-0">
                          Proven
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {arm.pulls}x tested
                      </Badge>
                      <span className={`text-xs shrink-0 ${arm.reward > 0 ? 'text-green-700 font-medium' : 'text-muted-foreground'}`}>
                        score: {arm.reward}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {currentFeedback === 'boosted' ? (
                        <Badge className="bg-green-100 text-green-800 text-xs gap-0.5">
                          <ThumbsUp className="h-3 w-3" /> Confirmed
                        </Badge>
                      ) : currentFeedback === 'penalized' ? (
                        <Badge className="bg-red-100 text-red-800 text-xs gap-0.5">
                          <ThumbsDown className="h-3 w-3" /> Rejected
                        </Badge>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Confirm: Boost this strategy's score. Use when you know this works well for your audience."
                            disabled={loading !== null}
                            onClick={() => doAction(
                              'boost_arm',
                              { platform: arm.platform, dimension: dim, armKey: arm.armKey },
                              feedbackKey,
                              'boosted'
                            )}
                          >
                            {loading === feedbackKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ThumbsUp className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            title="Reject: Lower this strategy's score. Use when you know this doesn't work for your audience."
                            disabled={loading !== null}
                            onClick={() => doAction(
                              'penalize_arm',
                              { platform: arm.platform, dimension: dim, armKey: arm.armKey },
                              feedbackKey,
                              'penalized'
                            )}
                          >
                            {loading === feedbackKey ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ThumbsDown className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ResetAllButtonProps {
  botId: string;
}

export function ResetAllLearningButton({ botId }: ResetAllButtonProps) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleReset = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/bots/${encodeURIComponent(botId)}/rl-control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_all' }),
      });

      if (res.ok) {
        window.location.reload();
      }
    } catch {
      // Ignore — user can retry
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  };

  return (
    <Button
      variant={confirming ? 'destructive' : 'outline'}
      size="sm"
      disabled={loading}
      onClick={handleReset}
      onBlur={() => setConfirming(false)}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
      ) : (
        <RotateCcw className="h-3.5 w-3.5 mr-1" />
      )}
      {confirming ? 'Click again to confirm reset' : 'Reset All Learning'}
    </Button>
  );
}
