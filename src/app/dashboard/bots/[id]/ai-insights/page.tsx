import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { Progress } from '@/components/ui/progress';
import { BotNav } from '@/components/dashboard/bot-nav';
import { ArmDistributionChart, EngagementScoreTrend } from '@/components/dashboard/ai-insights-charts';
import {
  Brain, TrendingUp, Target, Lightbulb, BarChart3, Sparkles,
  Clock, MessageSquare, Hash, Palette,
  Flame, Zap, Radio, AlertTriangle, Eye, BookOpen,
} from 'lucide-react';
import {
  PLATFORM_NAMES, RL_DIMENSION_LABELS,
  TONE_STYLES, HASHTAG_PATTERNS, CONTENT_TYPES,
} from '@/lib/constants';
import {
  getHypeState,
  LIFECYCLE_CONFIG,
  getHypeLevel,
  type HypeAlert,
  type TrendLifecycle,
} from '@/lib/hype-engine';

export const metadata: Metadata = {
  title: 'AI Insights',
  robots: { index: false },
};

// Human-readable label for an arm key within a dimension
function getArmLabel(dimension: string, armKey: string): string {
  if (dimension === 'TIME_SLOT') {
    const hour = parseInt(armKey);
    if (isNaN(hour)) return armKey;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:00 ${ampm}`;
  }
  if (dimension === 'CONTENT_TYPE') return CONTENT_TYPES.find(c => c.value === armKey)?.label || armKey;
  if (dimension === 'TONE_STYLE') return TONE_STYLES.find(t => t.value === armKey)?.label || armKey;
  if (dimension === 'HASHTAG_PATTERN') return HASHTAG_PATTERNS.find(h => h.value === armKey)?.label || armKey;
  return armKey;
}

const DIMENSION_ICONS: Record<string, typeof Clock> = {
  TIME_SLOT: Clock,
  CONTENT_TYPE: MessageSquare,
  HASHTAG_PATTERN: Hash,
  TONE_STYLE: Palette,
};

export default async function AIInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    select: {
      id: true, name: true, userId: true,
      algorithmConfig: true, keywords: true, brandName: true, goal: true,
    },
  });
  if (!bot) notFound();

  // ── Hype Detection State ──
  const hypeState = getHypeState(bot.algorithmConfig);
  const activeAlerts = hypeState.activeAlerts
    .filter(a => !a.dismissed && new Date(a.expiresAt).getTime() > Date.now())
    .sort((a, b) => b.hypeScore - a.hypeScore);
  const trendHistory = hypeState.trendHistory.slice(-10).reverse();
  const learnedPatterns = hypeState.learnedPatterns;

  const connectedPlatforms = await db.platformConnection.findMany({
    where: { botId: bot.id, status: 'CONNECTED' },
    select: { platform: true },
  });

  const [rlConfigs, allArmStates, recentEngagements, totalEngagements] = await Promise.all([
    db.rLConfig.findMany({
      where: { botId: bot.id },
      orderBy: { totalEpisodes: 'desc' },
    }),
    db.rLArmState.findMany({
      where: { botId: bot.id },
      orderBy: { ewmaReward: 'desc' },
    }),
    db.postEngagement.findMany({
      where: { botId: bot.id },
      orderBy: { postedAt: 'desc' },
      take: 200,
    }),
    db.postEngagement.count({ where: { botId: bot.id } }),
  ]);

  const totalEpisodes = rlConfigs.reduce((sum, c) => sum + c.totalEpisodes, 0);
  const avgEpsilon = rlConfigs.length > 0
    ? rlConfigs.reduce((sum, c) => sum + c.epsilon, 0) / rlConfigs.length
    : 0.2;
  const explorationPct = Math.round(avgEpsilon * 100);
  const exploitPct = 100 - explorationPct;
  const totalPulls = allArmStates.reduce((sum, a) => sum + a.pulls, 0);
  const overallConfidence = Math.round((1 - Math.exp(-totalPulls / 100)) * 100);

  const hasData = totalEpisodes > 0 || totalEngagements > 0;

  // Build best arms per dimension (across all platforms)
  const bestArmsByDimension: Record<string, { arm: string; reward: number; pulls: number; platform: string }> = {};
  for (const arm of allArmStates) {
    const key = arm.dimension;
    if (!bestArmsByDimension[key] || arm.ewmaReward > bestArmsByDimension[key].reward) {
      bestArmsByDimension[key] = {
        arm: arm.armKey,
        reward: Math.round(arm.ewmaReward * 100) / 100,
        pulls: arm.pulls,
        platform: arm.platform,
      };
    }
  }

  // Best arms per platform per dimension
  const platformInsights: Record<string, {
    epsilon: number;
    episodes: number;
    bestArms: Record<string, { arm: string; reward: number; pulls: number }>;
  }> = {};

  for (const config of rlConfigs) {
    const platformArms = allArmStates.filter(a => a.platform === config.platform);
    const bestArms: Record<string, { arm: string; reward: number; pulls: number }> = {};
    for (const arm of platformArms) {
      if (!bestArms[arm.dimension] || arm.ewmaReward > bestArms[arm.dimension].reward) {
        bestArms[arm.dimension] = {
          arm: arm.armKey,
          reward: Math.round(arm.ewmaReward * 100) / 100,
          pulls: arm.pulls,
        };
      }
    }
    platformInsights[config.platform] = {
      epsilon: config.epsilon,
      episodes: config.totalEpisodes,
      bestArms,
    };
  }

  // Arm distribution data for charts (aggregate across platforms per dimension)
  const dimensionDistributions: Record<string, { name: string; reward: number; pulls: number; confidence: number }[]> = {};
  const dimensions = ['TIME_SLOT', 'CONTENT_TYPE', 'HASHTAG_PATTERN', 'TONE_STYLE'];

  for (const dim of dimensions) {
    const arms = allArmStates.filter(a => a.dimension === dim);
    // Aggregate same armKey across platforms
    const aggregated: Record<string, { totalReward: number; totalPulls: number; count: number }> = {};
    for (const arm of arms) {
      if (!aggregated[arm.armKey]) {
        aggregated[arm.armKey] = { totalReward: 0, totalPulls: 0, count: 0 };
      }
      aggregated[arm.armKey].totalReward += arm.ewmaReward * arm.pulls;
      aggregated[arm.armKey].totalPulls += arm.pulls;
      aggregated[arm.armKey].count++;
    }
    dimensionDistributions[dim] = Object.entries(aggregated)
      .map(([key, data]) => ({
        name: getArmLabel(dim, key),
        reward: data.totalPulls > 0 ? Math.round((data.totalReward / data.totalPulls) * 100) / 100 : 0,
        pulls: data.totalPulls,
        confidence: data.totalPulls > 0 ? Math.round((1 - 1 / Math.sqrt(data.totalPulls)) * 100) : 0,
      }))
      .sort((a, b) => b.reward - a.reward)
      .slice(0, 15); // Limit for chart readability
  }

  // Engagement score trend (group by day)
  const engagementByDay: Record<string, { totalScore: number; count: number }> = {};
  for (const eng of recentEngagements) {
    const day = new Date(eng.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (!engagementByDay[day]) engagementByDay[day] = { totalScore: 0, count: 0 };
    engagementByDay[day].totalScore += eng.engagementScore;
    engagementByDay[day].count++;
  }
  const engagementTrend = Object.entries(engagementByDay)
    .map(([date, data]) => ({
      date,
      score: Math.round((data.totalScore / data.count) * 100) / 100,
      posts: data.count,
    }))
    .reverse()
    .slice(-30);

  // Generate actionable insights
  const actionableInsights: { icon: typeof TrendingUp; text: string; type: 'success' | 'info' | 'tip' }[] = [];

  if (Object.keys(bestArmsByDimension).length > 0) {
    const bestTime = bestArmsByDimension.TIME_SLOT;
    if (bestTime && bestTime.pulls >= 3) {
      actionableInsights.push({
        icon: Clock,
        text: `Your best posting time is ${getArmLabel('TIME_SLOT', bestTime.arm)} (avg score: ${bestTime.reward}, tested ${bestTime.pulls}x on ${PLATFORM_NAMES[bestTime.platform] || bestTime.platform}).`,
        type: 'success',
      });
    }

    const bestContent = bestArmsByDimension.CONTENT_TYPE;
    if (bestContent && bestContent.pulls >= 3) {
      actionableInsights.push({
        icon: MessageSquare,
        text: `"${getArmLabel('CONTENT_TYPE', bestContent.arm)}" content gets the highest engagement (score: ${bestContent.reward}).`,
        type: 'success',
      });
    }

    const bestTone = bestArmsByDimension.TONE_STYLE;
    if (bestTone && bestTone.pulls >= 3) {
      actionableInsights.push({
        icon: Palette,
        text: `"${getArmLabel('TONE_STYLE', bestTone.arm)}" tone resonates best with your audience.`,
        type: 'success',
      });
    }

    const bestHashtag = bestArmsByDimension.HASHTAG_PATTERN;
    if (bestHashtag && bestHashtag.pulls >= 3) {
      actionableInsights.push({
        icon: Hash,
        text: `"${getArmLabel('HASHTAG_PATTERN', bestHashtag.arm)}" hashtag strategy performs best.`,
        type: 'success',
      });
    }
  }

  if (explorationPct > 15) {
    actionableInsights.push({
      icon: Sparkles,
      text: `Exploration rate is ${explorationPct}%. The AI is still experimenting with different strategies. As more posts are analyzed, it will focus on proven winners.`,
      type: 'info',
    });
  } else if (explorationPct <= 15 && totalEpisodes > 0) {
    actionableInsights.push({
      icon: Target,
      text: `Exploration rate dropped to ${explorationPct}%. The AI is now mostly exploiting proven strategies with high confidence.`,
      type: 'success',
    });
  }

  if (connectedPlatforms.length > 0 && rlConfigs.length < connectedPlatforms.length) {
    const learningPlatforms = new Set(rlConfigs.map(c => c.platform));
    const missing = connectedPlatforms.filter(p => !learningPlatforms.has(p.platform));
    if (missing.length > 0) {
      actionableInsights.push({
        icon: Lightbulb,
        text: `${missing.map(p => PLATFORM_NAMES[p.platform] || p.platform).join(', ')} ${missing.length === 1 ? 'has' : 'have'} no learning data yet. Create posts on ${missing.length === 1 ? 'this platform' : 'these platforms'} to start optimizing.`,
        type: 'tip',
      });
    }
  }

  const insightColors = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    tip: 'bg-amber-50 border-amber-200 text-amber-800',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - AI Insights</h1>
        <p className="text-muted-foreground">See what your bot has learned from analyzing post performance.</p>
        <BotNav botId={id} activeTab="ai-insights" />
      </div>

      {/* How AI Learning Works - collapsible info */}
      <Card className="border-indigo-200 bg-indigo-50/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-600" />
            How AI learning works
            <HelpTip text="Your bot uses Thompson Sampling (a Bayesian multi-armed bandit algorithm) to explore different content strategies. It models uncertainty with probability distributions and naturally focuses on proven winners while still discovering new opportunities. Engagement scores are time-decay adjusted and normalized per platform." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              Your bot uses <strong>Thompson Sampling</strong> (a Bayesian reinforcement learning algorithm) to
              optimize posting strategy. It learns from engagement metrics (likes, comments, shares, saves) and
              automatically detects content characteristics using content fingerprinting.
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2 text-xs mt-2">
              <div className="flex items-start gap-1.5">
                <span className="font-medium text-foreground">Thompson Sampling</span> — Bayesian posterior sampling for natural exploration/exploitation balance
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-medium text-foreground">Content Fingerprinting</span> — Auto-detects tone, content type, hashtag patterns from post text
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-medium text-foreground">Time-Decay Adjustment</span> — Normalizes scores for post age (newer posts get fair comparison)
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-medium text-foreground">Bayesian Normalization</span> — Z-score normalization makes scores comparable across platforms
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════ HYPE RADAR ═══════════ */}
      {/* Active Hype Alerts — always visible when alerts exist */}
      {activeAlerts.length > 0 && (
        <Card className="border-orange-300 bg-gradient-to-br from-orange-50/50 to-red-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500" />
              Hype Radar — Active Trends
              <Badge variant="destructive" className="ml-2">{activeAlerts.length} active</Badge>
              <HelpTip text="Trends detected from your RSS feeds and global trend sources. Based on Berger's STEPPS framework, Welford's z-score spike detection, and Rogers' Diffusion of Innovations. The bot uses these to adapt content strategy in real-time." />
            </CardTitle>
            <CardDescription>
              Trending topics relevant to your niche. Act on these to ride the hype wave.
              Scientific basis: Berger &amp; Milkman (2012), Rogers (1962), Welford&apos;s Algorithm.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeAlerts.map((alert) => {
                const lcConfig = LIFECYCLE_CONFIG[alert.lifecycle as TrendLifecycle] || LIFECYCLE_CONFIG.EMERGENCE;
                const hypeLevel = getHypeLevel(alert.hypeScore);
                return (
                  <div key={alert.id} className="rounded-lg border p-4 bg-white/70">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-base">{alert.topic}</span>
                          <Badge className={`text-xs ${lcConfig.color}`}>
                            {lcConfig.emoji} {lcConfig.label}
                          </Badge>
                          <Badge className={`text-xs ${hypeLevel.bgColor} ${hypeLevel.color}`}>
                            Score: {alert.hypeScore}
                          </Badge>
                          {alert.relevanceScore >= 0.6 && (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                              High Relevance
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{lcConfig.description}</p>

                        {/* Suggested Action */}
                        <div className="bg-indigo-50 rounded-md p-3 mt-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Lightbulb className="h-4 w-4 text-indigo-600" />
                            <span className="text-xs font-medium text-indigo-800">Suggested Content Angle</span>
                          </div>
                          <p className="text-sm text-indigo-900">{alert.suggestedAngle}</p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              Type: {CONTENT_TYPES.find(c => c.value === alert.suggestedContentType)?.label || alert.suggestedContentType}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Tone: {TONE_STYLES.find(t => t.value === alert.suggestedTone)?.label || alert.suggestedTone}
                            </Badge>
                          </div>
                        </div>

                        {/* Source titles */}
                        {alert.sources.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs font-medium text-muted-foreground">Sources:</span>
                            <ul className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                              {alert.sources.map((source, i) => (
                                <li key={i} className="truncate">- {source}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-muted-foreground">Relevance</div>
                        <div className="text-lg font-bold">{Math.round(alert.relevanceScore * 100)}%</div>
                        <Progress value={alert.relevanceScore * 100} className="h-1.5 w-16 mt-1" />
                      </div>
                    </div>

                    {/* Metrics row */}
                    <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Hype: {alert.hypeScore}/100
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" /> Relevance: {Math.round(alert.relevanceScore * 100)}%
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Detected: {new Date(alert.detectedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Expires: {new Date(alert.expiresAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hype Learning Stats */}
      {hypeState.totalScans > 0 && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <Radio className="h-4 w-4 inline mr-1" />
                Trend Scans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{hypeState.totalScans}</div>
              <p className="text-xs text-muted-foreground">
                Last: {hypeState.lastScanAt ? new Date(hypeState.lastScanAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <Flame className="h-4 w-4 inline mr-1" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeAlerts.length}</div>
              <p className="text-xs text-muted-foreground">Topics trending now</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <BookOpen className="h-4 w-4 inline mr-1" />
                Topics Tracked
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(hypeState.topicStats).length}</div>
              <p className="text-xs text-muted-foreground">In rolling window</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <Target className="h-4 w-4 inline mr-1" />
                Hype Threshold
                <HelpTip text="The AI adjusts this threshold based on past trend-riding results. Lower = more aggressive (acts on weaker signals). Higher = more selective. Learned via engagement feedback loop." />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(learnedPatterns.optimalHypeThreshold)}</div>
              <p className="text-xs text-muted-foreground">
                Best stage: {LIFECYCLE_CONFIG[learnedPatterns.bestActionStage]?.label || 'Growth'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trend History (learned patterns) */}
      {trendHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Trend History — What the Bot Learned
              <HelpTip text="Past trends the system detected. The bot learns from these: when trend-riding produces high engagement, the hype threshold decreases (more aggressive). When it underperforms, the threshold increases (more selective). Based on Rogers' Diffusion of Innovations learning loop." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Topic</th>
                    <th className="text-left py-2 font-medium">Peak Score</th>
                    <th className="text-left py-2 font-medium">Stage</th>
                    <th className="text-left py-2 font-medium">Acted On</th>
                    <th className="text-left py-2 font-medium">Result</th>
                    <th className="text-right py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {trendHistory.map((trend, i) => {
                    const lcConfig = LIFECYCLE_CONFIG[trend.lifecycle as TrendLifecycle] || LIFECYCLE_CONFIG.DEAD;
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 font-medium">{trend.topic}</td>
                        <td className="py-2">
                          <Badge className={`text-xs ${getHypeLevel(trend.peakHypeScore).bgColor} ${getHypeLevel(trend.peakHypeScore).color}`}>
                            {trend.peakHypeScore}
                          </Badge>
                        </td>
                        <td className="py-2">
                          <Badge className={`text-xs ${lcConfig.color}`}>{lcConfig.label}</Badge>
                        </td>
                        <td className="py-2">
                          {trend.wasActedOn ? (
                            <Badge variant="outline" className="text-xs border-green-300 text-green-700">Yes</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">No</Badge>
                          )}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {trend.engagementResult != null
                            ? `Score: ${Math.round(trend.engagementResult * 10) / 10}`
                            : '-'}
                        </td>
                        <td className="text-right py-2 text-xs text-muted-foreground">
                          {new Date(trend.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hype Radar Empty State — show when no scans yet */}
      {hypeState.totalScans === 0 && (
        <Card className="border-dashed border-orange-200">
          <CardContent className="py-8 text-center">
            <Radio className="h-10 w-10 mx-auto text-orange-400 mb-3" />
            <h3 className="text-base font-semibold mb-1">Hype Radar Not Active Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The trend detection system scans RSS feeds and global trend sources every 10 minutes.
              Configure RSS feeds in Bot Settings to get personalized trend alerts. The system uses
              Welford&apos;s z-score spike detection, Berger&apos;s STEPPS virality framework, and
              Rogers&apos; Diffusion of Innovations model.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!hasData && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Welcome to AI Insights!</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first post to start the AI learning journey! The bot needs engagement data from
              published posts to learn which strategies work best for your audience.
            </p>
            <Link href={`/dashboard/bots/${id}/post`}>
              <Button><Sparkles className="mr-2 h-4 w-4" /> Create First Post</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Learning Episodes
              <HelpTip text="Total number of posts the AI has analyzed and learned from across all platforms." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEpisodes}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Posts Analyzed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEngagements}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Platforms</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rlConfigs.length}</div>
            <p className="text-xs text-muted-foreground">of {connectedPlatforms.length} connected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Exploration Rate
              <HelpTip text="Percentage of posts where the AI tries new strategies vs. using proven ones. Starts at 20% and decreases as the AI gains confidence. Lower = more confident." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{explorationPct}%</div>
            <Progress value={exploitPct} className="h-1.5 mt-1" />
            <p className="text-xs text-muted-foreground mt-1">{exploitPct}% exploitation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confidence
              <HelpTip text="Overall confidence in learned strategies. Based on total data points collected. Higher = more reliable recommendations." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallConfidence}%</div>
            <Progress value={overallConfidence} className="h-1.5 mt-1" />
          </CardContent>
        </Card>
      </div>

      {/* Actionable Insights */}
      {actionableInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" /> Actionable Insights
            </CardTitle>
            <CardDescription>Recommendations based on what the AI has learned so far.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {actionableInsights.map((insight, i) => {
                const Icon = insight.icon;
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${insightColors[insight.type]}`}>
                    <Icon className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm">{insight.text}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Best Strategies Per Dimension */}
      {Object.keys(bestArmsByDimension).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" /> Best Performing Strategies
              <HelpTip text="The top strategy the AI has identified across all platforms for each learning dimension. Score is the exponentially weighted average engagement." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {dimensions.map((dim) => {
                const best = bestArmsByDimension[dim];
                const Icon = DIMENSION_ICONS[dim] || Brain;
                return (
                  <div key={dim} className="flex items-center gap-4 p-4 rounded-lg border bg-muted/20">
                    <div className="shrink-0 p-2.5 rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{RL_DIMENSION_LABELS[dim] || dim}</p>
                      {best ? (
                        <>
                          <p className="font-semibold">{getArmLabel(dim, best.arm)}</p>
                          <p className="text-xs text-muted-foreground">
                            Score: {best.reward} | Tested {best.pulls}x
                            {best.platform && ` | Best on ${PLATFORM_NAMES[best.platform] || best.platform}`}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not enough data yet</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Engagement Score Trend */}
      {engagementTrend.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Engagement Score Trend
              <HelpTip text="Average engagement score per day. Score = Likes(1) + Comments(3) + Shares(5) + Saves(2) plus platform-specific bonuses. An upward trend means the AI is learning to post better content." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EngagementScoreTrend data={engagementTrend} />
          </CardContent>
        </Card>
      )}

      {/* Arm Distribution Charts */}
      {hasData && allArmStates.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-2">
          {dimensions.map((dim) => {
            const data = dimensionDistributions[dim] || [];
            if (data.length === 0) return null;
            const Icon = DIMENSION_ICONS[dim] || Brain;
            return (
              <Card key={dim}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4" />
                    {RL_DIMENSION_LABELS[dim] || dim}
                    <HelpTip text={`Performance ranking of all ${(RL_DIMENSION_LABELS[dim] || dim).toLowerCase()} options the AI has tested. Longer bars = higher average engagement score.`} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ArmDistributionChart data={data} label={RL_DIMENSION_LABELS[dim] || dim} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Per-Platform Learning Status */}
      {Object.keys(platformInsights).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> Platform Learning Status
              <HelpTip text="Detailed learning progress for each platform. Shows exploration vs exploitation balance and what strategy the AI considers best for each platform." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {Object.entries(platformInsights)
                .sort(([, a], [, b]) => b.episodes - a.episodes)
                .map(([platform, data]) => {
                  const platformExplore = Math.round(data.epsilon * 100);
                  const platformExploit = 100 - platformExplore;
                  return (
                    <div key={platform} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium">{PLATFORM_NAMES[platform] || platform}</h4>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{data.episodes} episodes</span>
                          <span>Explore: {platformExplore}% / Exploit: {platformExploit}%</span>
                        </div>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden mb-3">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${platformExploit}%` }}
                        />
                      </div>
                      {Object.keys(data.bestArms).length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {Object.entries(data.bestArms).map(([dim, arm]) => (
                            <div key={dim} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                              <span className="text-xs text-muted-foreground">{RL_DIMENSION_LABELS[dim] || dim}</span>
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="text-xs">{getArmLabel(dim, arm.arm)}</Badge>
                                <span className="text-xs text-muted-foreground">({arm.pulls}x, avg: {arm.reward})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not enough data yet. The bot needs more posts to identify patterns.</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Engagement Records */}
      {recentEngagements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" /> Recent Learning Data
              <HelpTip text="The most recent posts the AI has analyzed. Each row shows the engagement metrics and content dimensions that feed into the learning algorithm." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Platform</th>
                    <th className="text-left py-2 font-medium">Content</th>
                    <th className="text-left py-2 font-medium">Tone</th>
                    <th className="text-right py-2 font-medium">Likes</th>
                    <th className="text-right py-2 font-medium">Comments</th>
                    <th className="text-right py-2 font-medium">Shares</th>
                    <th className="text-right py-2 font-medium">Score</th>
                    <th className="text-right py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEngagements.slice(0, 20).map((eng) => (
                    <tr key={eng.id} className="border-b last:border-0">
                      <td className="py-2">
                        <Badge variant="outline" className="text-xs">
                          {PLATFORM_NAMES[eng.platform] || eng.platform}
                        </Badge>
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {eng.contentType ? getArmLabel('CONTENT_TYPE', eng.contentType) : '-'}
                      </td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {eng.toneStyle ? getArmLabel('TONE_STYLE', eng.toneStyle) : '-'}
                      </td>
                      <td className="text-right py-2">{eng.likes}</td>
                      <td className="text-right py-2">{eng.comments}</td>
                      <td className="text-right py-2">{eng.shares}</td>
                      <td className="text-right py-2 font-semibold">{Math.round(eng.engagementScore * 10) / 10}</td>
                      <td className="text-right py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(eng.postedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recentEngagements.length > 20 && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Showing 20 of {totalEngagements} records
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
