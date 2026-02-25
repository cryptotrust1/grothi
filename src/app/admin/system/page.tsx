import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle, AlertTriangle, XCircle, Clock, Database,
  Server, CreditCard, Activity, Shield, Zap, RefreshCw,
  AlertCircle, Bot,
} from 'lucide-react';

export const metadata: Metadata = { title: 'Admin — System Health', robots: { index: false } };

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

type HealthStatus = 'ok' | 'warning' | 'error' | 'unknown';

function statusBadge(status: HealthStatus) {
  switch (status) {
    case 'ok':      return <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="h-3 w-3" />OK</Badge>;
    case 'warning': return <Badge className="gap-1 bg-yellow-500/10 text-yellow-600 border-yellow-200"><AlertTriangle className="h-3 w-3" />Warning</Badge>;
    case 'error':   return <Badge className="gap-1 bg-red-500/10 text-red-600 border-red-200"><XCircle className="h-3 w-3" />Error</Badge>;
    default:        return <Badge variant="outline" className="gap-1"><AlertCircle className="h-3 w-3" />Unknown</Badge>;
  }
}

function formatAgo(date: Date | null | undefined): string {
  if (!date) return 'never';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)   return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

/** Derive cron health from a last-run date and expected interval (seconds). */
function cronStatus(lastRun: Date | null, intervalSec: number): HealthStatus {
  if (!lastRun) return 'unknown';
  const ageSec = (Date.now() - lastRun.getTime()) / 1000;
  if (ageSec < intervalSec * 2)  return 'ok';
  if (ageSec < intervalSec * 4)  return 'warning';
  return 'error';
}

// ─────────────────────────────────────────────────────────────
// Data fetching
// ─────────────────────────────────────────────────────────────

async function getSystemData() {
  const now = new Date();

  const [
    // DB counts
    userCount,
    sessionCount,
    botCount,
    activeBotCount,
    platformConnCount,
    errorConnCount,

    // Credit system
    creditBalanceSum,
    creditTxnCount,

    // Cron proxies
    latestActivity,        // process-posts indicator
    latestDailyStat,       // collect-engagement indicator
    latestHealthCheck,     // health-check indicator

    // Pending / stuck posts
    pendingPosts,
    publishingPosts,
    failedPosts24h,
    failedPostsTotal,

    // Recent errors
    recentErrors,
  ] = await Promise.all([
    db.user.count(),
    db.session.count({ where: { expiresAt: { gt: now } } }),
    db.bot.count(),
    db.bot.count({ where: { status: 'ACTIVE' } }),
    db.platformConnection.count({ where: { status: 'CONNECTED' } }),
    db.platformConnection.count({ where: { status: 'ERROR' } }),

    db.creditBalance.aggregate({ _sum: { balance: true } }),
    db.creditTransaction.count(),

    // process-posts: last BotActivity created (any bot action = cron fired)
    db.botActivity.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    // collect-engagement: last BotDailyStat update (use date field)
    db.botDailyStat.findFirst({ orderBy: { date: 'desc' }, select: { date: true } }),
    // health-check: last platform connection check (health-check touches updatedAt)
    db.platformConnection.findFirst({ orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),

    db.scheduledPost.count({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } } }),
    db.scheduledPost.count({ where: { status: 'PUBLISHING' } }),
    db.scheduledPost.count({
      where: { status: 'FAILED', updatedAt: { gte: new Date(now.getTime() - 24 * 3600_000) } },
    }),
    db.scheduledPost.count({ where: { status: 'FAILED' } }),

    db.botActivity.findMany({
      where: { success: false, createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        bot: { select: { name: true, user: { select: { email: true } } } },
      },
    }),
  ]);

  // Env var checks (server-side only; never expose values)
  const requiredEnvVars: { key: string; label: string; critical: boolean }[] = [
    { key: 'DATABASE_URL',          label: 'Database URL',          critical: true  },
    { key: 'NEXTAUTH_SECRET',       label: 'Auth Secret',           critical: true  },
    { key: 'ENCRYPTION_KEY',        label: 'Encryption Key',        critical: true  },
    { key: 'CRON_SECRET',           label: 'Cron Secret',           critical: true  },
    { key: 'ANTHROPIC_API_KEY',     label: 'Anthropic (Claude AI)', critical: false },
    { key: 'STRIPE_SECRET_KEY',     label: 'Stripe Secret Key',     critical: false },
    { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe Webhook Secret', critical: false },
    { key: 'FACEBOOK_APP_ID',       label: 'Facebook App ID',       critical: false },
    { key: 'NEXTAUTH_URL',          label: 'Site URL (NEXTAUTH_URL)',critical: false },
  ];

  const envStatus = requiredEnvVars.map(({ key, label, critical }) => ({
    label,
    critical,
    set: !!process.env[key],
  }));

  const processPostsLastRun = latestActivity?.createdAt ?? null;
  const collectEngagementLastRun = latestDailyStat?.date ?? null;
  const healthCheckLastRun = latestHealthCheck?.updatedAt ?? null;

  return {
    db: {
      userCount,
      sessionCount,
      botCount,
      activeBotCount,
      platformConnCount,
      errorConnCount,
    },
    credits: {
      totalInCirculation: creditBalanceSum._sum.balance ?? 0,
      transactionCount: creditTxnCount,
    },
    cron: {
      processPosts: {
        lastRun: processPostsLastRun,
        status: cronStatus(processPostsLastRun, 60),      // every 1 min
        interval: 'Every 1 min',
      },
      collectEngagement: {
        lastRun: collectEngagementLastRun,
        status: cronStatus(collectEngagementLastRun, 900), // every 15 min
        interval: 'Every 15 min',
      },
      healthCheck: {
        lastRun: healthCheckLastRun,
        status: cronStatus(healthCheckLastRun, 86400),    // daily
        interval: 'Daily (3 AM)',
      },
    },
    posts: {
      pending: pendingPosts,
      publishing: publishingPosts,
      failed24h: failedPosts24h,
      failedTotal: failedPostsTotal,
    },
    envStatus,
    recentErrors,
  };
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default async function SystemHealthPage() {
  await requireAdmin();
  const data = await getSystemData();

  const missingCritical = data.envStatus.filter(e => e.critical && !e.set).length;
  const missingOptional = data.envStatus.filter(e => !e.critical && !e.set).length;
  const overallEnvStatus: HealthStatus = missingCritical > 0 ? 'error' : missingOptional > 0 ? 'warning' : 'ok';

  const overallCronStatus: HealthStatus = (() => {
    const statuses = [data.cron.processPosts.status, data.cron.collectEngagement.status];
    if (statuses.includes('error'))   return 'error';
    if (statuses.includes('warning')) return 'warning';
    if (statuses.includes('unknown')) return 'unknown';
    return 'ok';
  })();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">System Health</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Real-time status of all platform components. Cron activity is inferred from database records.
        </p>
      </div>

      {/* ── Summary row ─────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Database className="h-4 w-4" />}
          title="Database"
          value={`${data.db.userCount.toLocaleString()} users`}
          sub={`${data.db.sessionCount.toLocaleString()} active sessions`}
          status="ok"
        />
        <SummaryCard
          icon={<Server className="h-4 w-4" />}
          title="Environment"
          value={`${data.envStatus.filter(e => e.set).length} / ${data.envStatus.length} vars set`}
          sub={missingCritical > 0 ? `${missingCritical} critical missing` : 'All critical vars set'}
          status={overallEnvStatus}
        />
        <SummaryCard
          icon={<RefreshCw className="h-4 w-4" />}
          title="Cron Jobs"
          value={data.cron.processPosts.status === 'ok' ? 'Running' : 'Check required'}
          sub={`Posts cron: ${formatAgo(data.cron.processPosts.lastRun)}`}
          status={overallCronStatus}
        />
        <SummaryCard
          icon={<Bot className="h-4 w-4" />}
          title="Active Bots"
          value={`${data.db.activeBotCount} / ${data.db.botCount}`}
          sub={`${data.db.platformConnCount} platform connections`}
          status={data.db.errorConnCount > 0 ? 'warning' : 'ok'}
        />
      </div>

      {/* ── Environment variables ────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-4 w-4" />
            Environment Variables
          </CardTitle>
          <CardDescription>
            Critical vars must be set for the platform to function. Optional vars enable specific features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.envStatus.map(ev => (
              <div key={ev.label} className="flex items-center justify-between px-3 py-2 rounded border bg-muted/20">
                <div>
                  <span className="text-sm font-medium">{ev.label}</span>
                  {ev.critical && <span className="ml-1.5 text-[10px] text-red-500 font-semibold uppercase">required</span>}
                </div>
                {ev.set
                  ? <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="h-3 w-3" />Set</Badge>
                  : <Badge className={`gap-1 ${ev.critical ? 'bg-red-500/10 text-red-600 border-red-200' : 'bg-yellow-500/10 text-yellow-600 border-yellow-200'}`}>
                      <XCircle className="h-3 w-3" />{ev.critical ? 'Missing' : 'Not set'}
                    </Badge>
                }
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Cron jobs ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            Background Workers (Cron Jobs)
          </CardTitle>
          <CardDescription>
            Last-run time is inferred from database activity — it does not directly measure cron execution.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <CronCard
              title="Process Posts"
              endpoint="POST /api/cron/process-posts"
              interval={data.cron.processPosts.interval}
              lastRun={data.cron.processPosts.lastRun}
              status={data.cron.processPosts.status}
              note="Publishes SCHEDULED posts. Status inferred from latest BotActivity."
            />
            <CronCard
              title="Collect Engagement"
              endpoint="POST /api/cron/collect-engagement"
              interval={data.cron.collectEngagement.interval}
              lastRun={data.cron.collectEngagement.lastRun}
              status={data.cron.collectEngagement.status}
              note="Fetches likes/comments/shares. Status inferred from BotDailyStat."
            />
            <CronCard
              title="Health Check"
              endpoint="POST /api/cron/health-check"
              interval={data.cron.healthCheck.interval}
              lastRun={data.cron.healthCheck.lastRun}
              status={data.cron.healthCheck.status}
              note="Validates platform tokens. Status inferred from PlatformConnection."
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Post scheduler health ────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4" />
              Post Scheduler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatRow
                label="Overdue (scheduled, not yet processed)"
                value={data.posts.pending}
                status={data.posts.pending === 0 ? 'ok' : data.posts.pending <= 5 ? 'warning' : 'error'}
              />
              <StatRow
                label="Currently publishing"
                value={data.posts.publishing}
                status={data.posts.publishing <= 10 ? 'ok' : 'warning'}
              />
              <StatRow
                label="Failed in last 24 hours"
                value={data.posts.failed24h}
                status={data.posts.failed24h === 0 ? 'ok' : data.posts.failed24h <= 3 ? 'warning' : 'error'}
              />
              <StatRow
                label="Total failed (all time)"
                value={data.posts.failedTotal}
                status="unknown"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Credit System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <StatRow
                label="Credits in circulation"
                value={data.credits.totalInCirculation.toLocaleString()}
                status="ok"
              />
              <StatRow
                label="Platform connections (connected)"
                value={data.db.platformConnCount}
                status="ok"
              />
              <StatRow
                label="Platform connections (error)"
                value={data.db.errorConnCount}
                status={data.db.errorConnCount === 0 ? 'ok' : 'warning'}
              />
              <StatRow
                label="Credit transactions (total)"
                value={data.credits.transactionCount.toLocaleString()}
                status="ok"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent errors ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            Recent Bot Errors
            <span className="text-xs font-normal text-muted-foreground ml-1">(last 24 h)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentErrors.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-600 py-2">
              <CheckCircle className="h-4 w-4" />
              No bot errors in the last 24 hours.
            </div>
          ) : (
            <div className="space-y-2">
              {data.recentErrors.map(err => (
                <div key={err.id} className="flex items-start justify-between gap-4 rounded border px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="destructive" className="text-[9px]">{err.action}</Badge>
                      <Badge variant="outline" className="text-[9px]">{err.platform}</Badge>
                      <span className="font-medium truncate">{err.bot.name}</span>
                      <span className="text-muted-foreground">— {err.bot.user.email}</span>
                    </div>
                    {err.error && (
                      <p className="mt-1 text-muted-foreground truncate max-w-[480px]">{err.error}</p>
                    )}
                  </div>
                  <time className="shrink-0 text-muted-foreground">{formatAgo(err.createdAt)}</time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon, title, value, sub, status,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  sub: string;
  status: HealthStatus;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          {icon}{title}
        </CardTitle>
        {statusBadge(status)}
      </CardHeader>
      <CardContent>
        <div className="text-xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function CronCard({
  title, endpoint, interval, lastRun, status, note,
}: {
  title: string;
  endpoint: string;
  interval: string;
  lastRun: Date | null;
  status: HealthStatus;
  note: string;
}) {
  return (
    <div className="rounded border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{title}</span>
        {statusBadge(status)}
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3 shrink-0" />
          <span>{interval}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span>Last detected: <strong className="text-foreground">{formatAgo(lastRun)}</strong></span>
        </div>
        <code className="block mt-2 bg-muted rounded px-2 py-1 text-[10px] font-mono">{endpoint}</code>
        <p className="mt-1 text-[11px] italic">{note}</p>
      </div>
    </div>
  );
}

function StatRow({
  label, value, status,
}: {
  label: string;
  value: string | number;
  status: HealthStatus;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono font-medium">{value}</span>
        {status !== 'unknown' && statusBadge(status)}
      </div>
    </div>
  );
}
