import { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActionCost, hasEnoughCredits } from '@/lib/credits';
import { getContentRecommendation, fingerprintContent } from '@/lib/rl-engine';
import { PLATFORM_NAMES, PLATFORM_REQUIREMENTS, POST_STATUS_COLORS } from '@/lib/constants';
import { BotNav } from '@/components/dashboard/bot-nav';
import { PostFormClient } from '@/components/dashboard/post-form-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Clock, Trash2, RefreshCw, Download,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import type { PlatformType } from '@prisma/client';

// Per-platform publish result stored in publishResults JSON field
type PlatformPublishResult = { success: boolean; externalId?: string; error?: string };
type PublishResults = Record<string, PlatformPublishResult>;

export const metadata: Metadata = { title: 'New Post', robots: { index: false } };

export default async function ManualPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    success?: string;
    error?: string;
    mediaId?: string;
    view?: string;
    status?: string;
    month?: string;
  }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const sp = await searchParams;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: {
      platformConns: { where: { status: 'CONNECTED' }, select: { platform: true } },
    },
  });
  if (!bot) notFound();

  const connectedPlatforms = bot.platformConns.map(p => p.platform);

  // ── Post list filters & calendar ─────────────────────────────
  const listView = sp.view || 'list';
  const statusFilter = sp.status || 'ALL';

  const now = new Date();
  const rawMonthStr = sp.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [parsedYear, parsedMonth] = rawMonthStr.split('-').map(Number);
  const calYear = (Number.isFinite(parsedYear) && parsedYear >= 2020 && parsedYear <= 2100) ? parsedYear : now.getFullYear();
  const calMonth = (Number.isFinite(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) ? parsedMonth : (now.getMonth() + 1);
  const monthStr = `${calYear}-${String(calMonth).padStart(2, '0')}`;

  const monthStart = new Date(calYear, calMonth - 1, 1);
  const monthEnd = new Date(calYear, calMonth, 0, 23, 59, 59);

  const postWhere: Record<string, unknown> = { botId: bot.id };
  if (statusFilter !== 'ALL') {
    postWhere.status = statusFilter;
  }
  if (listView === 'calendar') {
    postWhere.scheduledAt = { gte: monthStart, lte: monthEnd };
  }

  // Media library with full details for compatibility checks
  const mediaLibrary = await db.media.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      filename: true,
      type: true,
      mimeType: true,
      fileSize: true,
      altText: true,
      platformCaptions: true,
      width: true,
      height: true,
    },
  });

  // All posts with filters for the post manager section
  const [allPosts, draftsCount, scheduledCount, publishedCount, failedCount] = await Promise.all([
    db.scheduledPost.findMany({
      where: postWhere as any,
      orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        media: { select: { id: true, filename: true, type: true } },
        product: { select: { id: true, name: true } },
      },
      take: 200,
    }),
    db.scheduledPost.count({ where: { botId: bot.id, status: 'DRAFT' } }),
    db.scheduledPost.count({ where: { botId: bot.id, status: 'SCHEDULED' } }),
    db.scheduledPost.count({ where: { botId: bot.id, status: 'PUBLISHED' } }),
    db.scheduledPost.count({ where: { botId: bot.id, status: 'FAILED' } }),
  ]);

  // Products for the post form selector (fetch ALL media for product media picker)
  const products = await db.product.findMany({
    where: { botId: bot.id, isActive: true },
    include: {
      productMedia: {
        orderBy: { sortOrder: 'asc' },
        include: { media: { select: { id: true, filename: true, type: true, fileSize: true, mimeType: true } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Recent posts for the form reference (top 5)
  const recentPosts = allPosts.slice(0, 5);

  // Get credit info
  const postCost = await getActionCost('POST');
  const creditBalance = await db.creditBalance.findUnique({
    where: { userId: user.id },
    select: { balance: true },
  });
  const userCredits = creditBalance?.balance || 0;

  // ── Server Action ──────────────────────────────────────────

  async function handleCreatePost(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentBot = await db.bot.findFirst({
      where: { id, userId: currentUser.id },
      include: { platformConns: { where: { status: 'CONNECTED' }, select: { platform: true } } },
    });
    if (!currentBot) redirect('/dashboard/bots');

    const content = (formData.get('content') as string)?.trim();
    if (!content) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Content is required')}`);
    }

    const platformsRaw = formData.getAll('platforms') as string[];
    if (platformsRaw.length === 0) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Select at least one platform')}`);
    }

    // Validate platforms are actually connected
    const connectedSet = new Set(currentBot.platformConns.map(p => p.platform));
    const invalidPlatforms = platformsRaw.filter(p => !connectedSet.has(p as any));
    if (invalidPlatforms.length > 0) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Platform not connected: ${invalidPlatforms.map(p => PLATFORM_NAMES[p] || p).join(', ')}`)}`);
    }

    const mediaId = (formData.get('mediaId') as string) || null;
    const productId = (formData.get('productId') as string) || null;
    const action = formData.get('action') as string;
    const scheduledAt = formData.get('scheduledAt') as string;
    const igPostType = (formData.get('postType') as string) || null;
    const fbPostType = (formData.get('fbPostType') as string) || null;
    const threadsPostType = (formData.get('threadsPostType') as string) || null;

    // Combine per-platform post types into JSON string for storage
    const postTypeMap: Record<string, string> = {};
    if (igPostType) postTypeMap.instagram = igPostType;
    if (fbPostType) postTypeMap.facebook = fbPostType;
    if (threadsPostType) postTypeMap.threads = threadsPostType;
    const postType = Object.keys(postTypeMap).length > 0 ? JSON.stringify(postTypeMap) : null;

    // Validate media ownership
    if (mediaId) {
      const media = await db.media.findFirst({ where: { id: mediaId, botId: id } });
      if (!media) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Media not found')}`);
      }
    }

    // Validate product ownership
    if (productId) {
      const product = await db.product.findFirst({ where: { id: productId, botId: id, isActive: true } });
      if (!product) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Product not found')}`);
      }
    }

    // ── Platform requirement validation (server-side) ──────

    // Check media requirements
    const mediaRequiredPlatforms = platformsRaw.filter(p => {
      const req = PLATFORM_REQUIREMENTS[p];
      return req?.mediaRequired && !mediaId;
    });

    if (mediaRequiredPlatforms.length > 0) {
      const names = mediaRequiredPlatforms.map(p => PLATFORM_NAMES[p] || p).join(', ');
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Media required for: ${names}. These platforms do not support text-only posts. Attach an image or video, or deselect these platforms.`)}`);
    }

    // Check character limits
    for (const p of platformsRaw) {
      const req = PLATFORM_REQUIREMENTS[p];
      if (req && content.length > req.maxCharacters) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Content too long for ${req.name}: ${content.length.toLocaleString()} chars (max ${req.maxCharacters.toLocaleString()})`)}`);
      }
    }

    // Check media format compatibility
    if (mediaId) {
      const media = await db.media.findFirst({
        where: { id: mediaId, botId: id },
        select: { type: true, mimeType: true, fileSize: true },
      });

      if (media) {
        const mimeToFormat: Record<string, string> = {
          'image/jpeg': 'JPEG',
          'image/png': 'PNG',
          'image/gif': 'GIF',
          'image/webp': 'WebP',
          'image/avif': 'AVIF',
          'video/mp4': 'MP4',
          'video/webm': 'WebM',
          'video/quicktime': 'MOV',
        };
        const mediaFormat = mimeToFormat[media.mimeType] || '';
        const fileSizeMB = media.fileSize / (1024 * 1024);

        for (const p of platformsRaw) {
          const req = PLATFORM_REQUIREMENTS[p];
          if (!req) continue;

          // Check media type support
          if (!req.supportedMediaTypes.includes(media.type as 'IMAGE' | 'VIDEO' | 'GIF')) {
            redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`${req.name} does not support ${media.type.toLowerCase()} files. Remove ${req.name} or choose different media.`)}`);
          }

          // Check format support
          if (media.type === 'IMAGE' && req.imageFormats.length > 0 && !req.imageFormats.includes(mediaFormat)) {
            redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`${req.name} does not support ${mediaFormat} images. Supported formats: ${req.imageFormats.join(', ')}.`)}`);
          }

          // Check file size
          if (media.type === 'VIDEO' && req.maxVideoSizeMB > 0 && fileSizeMB > req.maxVideoSizeMB) {
            redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Video too large for ${req.name}: ${fileSizeMB.toFixed(1)}MB (max ${req.maxVideoSizeMB}MB).`)}`);
          }
          if (media.type !== 'VIDEO' && fileSizeMB > req.maxImageSizeMB) {
            redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Image too large for ${req.name}: ${fileSizeMB.toFixed(1)}MB (max ${req.maxImageSizeMB}MB).`)}`);
          }
        }
      }
    }

    // ── Determine status and scheduledAt ──────────────────────

    let finalStatus: 'DRAFT' | 'SCHEDULED' = 'DRAFT';
    let finalScheduledAt: Date | null = null;

    if (action === 'now') {
      finalStatus = 'SCHEDULED';
      finalScheduledAt = new Date();
    } else if (action === 'schedule' && scheduledAt) {
      const parsed = new Date(scheduledAt);
      if (isNaN(parsed.getTime())) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Invalid date format')}`);
      }
      if (parsed <= new Date()) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Scheduled time must be in the future')}`);
      }
      finalStatus = 'SCHEDULED';
      finalScheduledAt = parsed;
    }

    // Check credits for immediate post (deduction happens in process-posts cron on success)
    if (action === 'now') {
      const cost = await getActionCost('POST');
      const totalCost = cost * platformsRaw.length;
      const hasCredits = await hasEnoughCredits(currentUser.id, totalCost);
      if (!hasCredits) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Not enough credits. Need ${totalCost} credits (${cost} per platform x ${platformsRaw.length} platforms).`)}`);
      }
    }

    // Step 1: Fingerprint the actual post content for accurate dimension labeling.
    // This analyzes what the user actually wrote rather than guessing.
    const fingerprint = fingerprintContent(content);
    let toneStyle: string | null = fingerprint.toneStyle;
    let hashtagPattern: string | null = fingerprint.hashtagPattern;
    let contentType: string = fingerprint.contentType;

    // Step 2: Get RL recommendation for additional context.
    // If the RL engine has high confidence, prefer its recommendation for dimensions
    // the fingerprinter is less certain about.
    try {
      const firstPlatform = platformsRaw[0] as PlatformType;
      const recommendation = await getContentRecommendation(
        id, firstPlatform, currentBot.safetyLevel || 'MODERATE'
      );
      if (recommendation && recommendation.confidence > 0.5) {
        // High confidence RL: use RL recommendation for tone/content if fingerprint
        // confidence is low (below 0.3 means the fingerprinter found few signals)
        if (fingerprint.confidence < 0.3) {
          toneStyle = recommendation.toneStyle;
          contentType = recommendation.contentType;
        }
        // Always use RL for hashtag if fingerprint detected 'none'
        // (user may not have added hashtags yet; RL knows what works)
        if (hashtagPattern === 'none' && recommendation.hashtagPattern !== 'none') {
          hashtagPattern = recommendation.hashtagPattern;
        }
      }
    } catch {
      // RL recommendation is best-effort; fingerprint provides the baseline
    }

    await db.scheduledPost.create({
      data: {
        botId: id,
        content,
        contentType,
        mediaId,
        productId,
        postType: postType || null,
        platforms: platformsRaw,
        scheduledAt: finalScheduledAt,
        autoSchedule: false,
        status: finalStatus,
        toneStyle,
        hashtagPattern,
      },
    });

    const actionLabel = action === 'now'
      ? 'Post queued for immediate publishing!'
      : action === 'schedule'
        ? 'Post scheduled successfully!'
        : 'Post saved as draft.';

    redirect(`/dashboard/bots/${id}/post?success=${encodeURIComponent(actionLabel)}`);
  }

  // ── Delete server action ──────────────────────────────────────

  async function handleDeletePost(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const postId = formData.get('postId') as string;
    if (!postId) redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Post not found')}`);

    const post = await db.scheduledPost.findUnique({
      where: { id: postId },
      include: { bot: { select: { userId: true } } },
    });

    if (!post || post.bot.userId !== currentUser.id) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Post not found')}`);
    }

    if (!['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status)) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Only draft, scheduled, or failed posts can be deleted')}`);
    }

    await db.scheduledPost.delete({ where: { id: postId } });
    redirect(`/dashboard/bots/${id}/post?success=${encodeURIComponent('Post deleted')}`);
  }

  // ── Retry failed post server action ───────────────────────────

  async function handleRetryPost(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const postId = formData.get('postId') as string;
    if (!postId) redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Post not found')}`);

    const post = await db.scheduledPost.findUnique({
      where: { id: postId },
      include: { bot: { select: { userId: true } } },
    });

    if (!post || post.bot.userId !== currentUser.id) {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Post not found')}`);
    }

    if (post.status !== 'FAILED') {
      redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Only failed posts can be retried')}`);
    }

    await db.scheduledPost.update({
      where: { id: postId },
      data: {
        status: 'SCHEDULED',
        scheduledAt: new Date(),
        error: null,
        publishedAt: null,
      },
    });

    redirect(`/dashboard/bots/${id}/post?success=${encodeURIComponent('Post queued for retry')}`);
  }

  // ── Render ──────────────────────────────────────────────────

  // Serialize data for client component
  const serializedMediaLibrary = mediaLibrary.map(m => ({
    id: m.id,
    filename: m.filename,
    type: m.type,
    mimeType: m.mimeType,
    fileSize: m.fileSize,
    altText: m.altText,
    platformCaptions: (m.platformCaptions as Record<string, string> | null),
    width: m.width,
    height: m.height,
  }));

  const serializedRecentPosts = recentPosts.map(post => ({
    id: post.id,
    status: post.status,
    content: post.content,
    createdAt: post.createdAt.toISOString(),
    platforms: Array.isArray(post.platforms) ? post.platforms as string[] : [],
    media: post.media ? { id: post.media.id, filename: post.media.filename, type: post.media.type } : null,
  }));

  const serializedProducts = products.map(p => {
    const primaryPm = p.productMedia.find(pm => pm.isPrimary);
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      category: p.category,
      price: p.price,
      primaryImage: primaryPm?.media || p.productMedia[0]?.media || null,
      mediaCount: p.productMedia.length,
      media: p.productMedia.map(pm => ({
        id: pm.media.id,
        filename: pm.media.filename,
        type: pm.media.type,
        fileSize: pm.media.fileSize,
        mimeType: pm.media.mimeType,
        isPrimary: pm.isPrimary,
      })),
    };
  });

  // ── Calendar data ──────────────────────────────────────────

  const daysInMonth = new Date(calYear, calMonth, 0).getDate();
  const firstDayOfWeek = new Date(calYear, calMonth - 1, 1).getDay();
  const prevMonth = calMonth === 1 ? `${calYear - 1}-12` : `${calYear}-${String(calMonth - 1).padStart(2, '0')}`;
  const nextMonth = calMonth === 12 ? `${calYear + 1}-01` : `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
  const monthName = new Date(calYear, calMonth - 1).toLocaleString('en', { month: 'long', year: 'numeric' });

  const postsByDate: Record<string, typeof allPosts> = {};
  for (const post of allPosts) {
    if (post.scheduledAt) {
      const dateKey = post.scheduledAt.toISOString().split('T')[0];
      if (!postsByDate[dateKey]) postsByDate[dateKey] = [];
      postsByDate[dateKey].push(post);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - Post Scheduler</h1>
        <p className="text-sm text-muted-foreground mt-1">Create, schedule, and manage your posts across all platforms.</p>
        <BotNav botId={id} activeTab="post" />
      </div>

      <form action={handleCreatePost} id="post-form" className="hidden" />
      <form action={handleDeletePost} id="delete-form" className="hidden" />
      <form action={handleRetryPost} id="retry-form" className="hidden" />

      {/* ═══════ Stats Cards ═══════ */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{draftsCount}</p>
            <p className="text-xs text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{scheduledCount}</p>
            <p className="text-xs text-muted-foreground">Scheduled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
            <p className="text-xs text-muted-foreground">Published</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ Create Post Form ═══════ */}
      <PostFormClient
        botId={id}
        botName={bot.name}
        connectedPlatforms={connectedPlatforms}
        platformRequirements={PLATFORM_REQUIREMENTS}
        platformNames={PLATFORM_NAMES}
        postStatusColors={POST_STATUS_COLORS}
        mediaLibrary={serializedMediaLibrary}
        recentPosts={serializedRecentPosts}
        products={serializedProducts}
        postCost={postCost}
        userCredits={userCredits}
        preSelectedMediaId={sp.mediaId || null}
        successMessage={sp.success || null}
        errorMessage={sp.error || null}
      />

      {/* ═══════ Post Manager ═══════ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 justify-between flex-wrap">
          {/* Status filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {[
              { key: 'ALL', label: 'All' },
              { key: 'DRAFT', label: 'Draft' },
              { key: 'SCHEDULED', label: 'Scheduled' },
              { key: 'PUBLISHED', label: 'Published' },
              { key: 'FAILED', label: 'Failed' },
            ].map((s) => (
              <Link
                key={s.key}
                href={`/dashboard/bots/${id}/post?view=${listView}&status=${s.key}`}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  statusFilter === s.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-input'
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex gap-1">
            <Link
              href={`/dashboard/bots/${id}/post?view=list&status=${statusFilter}`}
              className={`text-xs px-3 py-1.5 rounded border ${listView === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              List
            </Link>
            <Link
              href={`/dashboard/bots/${id}/post?view=calendar&status=${statusFilter}&month=${monthStr}`}
              className={`text-xs px-3 py-1.5 rounded border ${listView === 'calendar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              Calendar
            </Link>
          </div>
        </div>

        {/* ═══════ Calendar View ═══════ */}
        {listView === 'calendar' && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Link href={`/dashboard/bots/${id}/post?view=calendar&status=${statusFilter}&month=${prevMonth}`}>
                  <Button variant="ghost" size="sm"><ChevronLeft className="h-4 w-4" /></Button>
                </Link>
                <CardTitle className="text-lg">{monthName}</CardTitle>
                <Link href={`/dashboard/bots/${id}/post?view=calendar&status=${statusFilter}&month=${nextMonth}`}>
                  <Button variant="ghost" size="sm"><ChevronRight className="h-4 w-4" /></Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="bg-background p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="bg-background p-2 min-h-[80px]" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateKey = `${calYear}-${String(calMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayPosts = postsByDate[dateKey] || [];
                  const isToday = now.getFullYear() === calYear && now.getMonth() === calMonth - 1 && now.getDate() === day;

                  return (
                    <div key={day} className={`bg-background p-1.5 min-h-[80px] ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}>
                      <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>{day}</p>
                      <div className="space-y-0.5">
                        {dayPosts.slice(0, 3).map((post) => {
                          const platforms = Array.isArray(post.platforms) ? post.platforms as string[] : [];
                          const results = (post.status === 'PUBLISHED' || post.status === 'FAILED')
                            ? post.publishResults as PublishResults | null
                            : null;

                          // Build detailed tooltip
                          const tipLines: string[] = [
                            post.content.slice(0, 150),
                            '',
                            `Status: ${post.status}`,
                            `Created: ${new Date(post.createdAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
                          ];
                          if (post.scheduledAt) tipLines.push(`Scheduled: ${new Date(post.scheduledAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
                          if (post.publishedAt) tipLines.push(`Posted: ${new Date(post.publishedAt).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
                          if (results) {
                            tipLines.push('');
                            for (const [p, r] of Object.entries(results)) {
                              tipLines.push(`${r.success ? '✓' : '✗'} ${PLATFORM_NAMES[p] || p}${r.error ? ': ' + r.error : ''}`);
                            }
                          }

                          return (
                            <div
                              key={post.id}
                              className={`text-[9px] leading-tight px-1 py-0.5 rounded truncate ${POST_STATUS_COLORS[post.status] || 'bg-gray-100'}`}
                              title={tipLines.join('\n')}
                            >
                              {post.scheduledAt ? new Date(post.scheduledAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) : ''}{' '}
                              {results ? (
                                platforms.map((p, i) => {
                                  const abbr = (PLATFORM_NAMES[p] || p).slice(0, 2);
                                  const r = results[p];
                                  if (!r) return <span key={p}>{i > 0 ? '·' : ''}{abbr}</span>;
                                  return (
                                    <span key={p} className={r.success ? '' : 'line-through opacity-60'}>
                                      {i > 0 ? '·' : ''}{r.success ? '✓' : '✗'}{abbr}
                                    </span>
                                  );
                                })
                              ) : (
                                platforms.map(p => (PLATFORM_NAMES[p] || p).slice(0, 2)).join('·')
                              )}
                            </div>
                          );
                        })}
                        {dayPosts.length > 3 && (
                          <p className="text-[9px] text-muted-foreground">+{dayPosts.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══════ List View ═══════ */}
        {listView === 'list' && (
          <div className="space-y-3">
            {allPosts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {statusFilter === 'ALL'
                      ? 'No posts yet. Create your first post above!'
                      : `No ${statusFilter.toLowerCase()} posts.`}
                  </p>
                </CardContent>
              </Card>
            ) : (
              allPosts.map((post) => {
                const platforms = Array.isArray(post.platforms) ? post.platforms as string[] : [];
                return (
                  <Card key={post.id}>
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Media thumbnail */}
                        {post.media && (
                          <div className="shrink-0 relative group/media">
                            {post.media.type === 'VIDEO' ? (
                              <div className="relative h-16 w-16 rounded overflow-hidden bg-muted">
                                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                <video
                                  src={`/api/media/${post.media.id}`}
                                  className="h-full w-full object-cover"
                                  muted
                                  preload="metadata"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <div className="h-6 w-6 rounded-full bg-black/50 flex items-center justify-center">
                                    <svg className="h-3 w-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={`/api/media/${post.media.id}`}
                                alt={post.media.filename}
                                className="h-16 w-16 rounded object-cover"
                              />
                            )}
                            <a
                              href={`/api/media/${post.media.id}?download=true`}
                              download={post.media.filename}
                              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border shadow-sm flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity"
                              title={`Download ${post.media.filename}`}
                            >
                              <Download className="h-3 w-3" />
                            </a>
                          </div>
                        )}

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Status & per-platform results */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${POST_STATUS_COLORS[post.status]}`}>
                              {post.status}
                            </span>
                            {(() => {
                              const results = (post.status === 'PUBLISHED' || post.status === 'FAILED')
                                ? post.publishResults as PublishResults | null
                                : null;
                              return platforms.map((p) => {
                                const name = PLATFORM_NAMES[p] || p;
                                if (results && results[p]) {
                                  return results[p].success ? (
                                    <Badge key={p} variant="outline" className="text-[10px] h-5 border-green-300 text-green-700 bg-green-50">
                                      ✓ {name}
                                    </Badge>
                                  ) : (
                                    <Badge key={p} variant="outline" className="text-[10px] h-5 border-red-300 text-red-700 bg-red-50">
                                      ✗ {name}
                                    </Badge>
                                  );
                                }
                                return (
                                  <Badge key={p} variant="outline" className="text-[10px] h-5">
                                    {name}
                                  </Badge>
                                );
                              });
                            })()}
                            {post.autoSchedule && (
                              <Badge variant="secondary" className="text-[10px] h-5">Auto</Badge>
                            )}
                            {post.product && (
                              <Badge variant="outline" className="text-[10px] h-5 border-amber-300 text-amber-700 bg-amber-50">
                                {post.product.name}
                              </Badge>
                            )}
                          </div>

                          {/* Content preview */}
                          <p className="text-sm line-clamp-2">{post.content}</p>

                          {/* Times */}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                            <span>
                              Created {new Date(post.createdAt).toLocaleString('en', {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {post.scheduledAt && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Scheduled {new Date(post.scheduledAt).toLocaleString('en', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            )}
                            {post.publishedAt && (
                              <span className="text-green-600">
                                Posted {new Date(post.publishedAt).toLocaleString('en', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>

                          {/* Per-platform error details */}
                          {(() => {
                            const results = (post.status === 'PUBLISHED' || post.status === 'FAILED')
                              ? post.publishResults as PublishResults | null
                              : null;
                            if (results) {
                              const failed = Object.entries(results).filter(([, r]) => !r.success && r.error);
                              if (failed.length > 0) {
                                return (
                                  <div className="space-y-0.5 mt-1">
                                    {failed.map(([p, r]) => (
                                      <p key={p} className="text-[11px] text-red-600">
                                        ✗ {PLATFORM_NAMES[p] || p}: {r.error}
                                      </p>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            }
                            // Fallback: show generic error for older posts without publishResults
                            if (post.error) {
                              return <p className="text-[11px] text-destructive mt-1">{post.error}</p>;
                            }
                            return null;
                          })()}
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex flex-col gap-1">
                          {/* Retry button for FAILED posts */}
                          {post.status === 'FAILED' && (
                            <form action={handleRetryPost}>
                              <input type="hidden" name="postId" value={post.id} />
                              <Button variant="ghost" size="sm" className="text-blue-600 h-8 w-8 p-0" title="Retry">
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            </form>
                          )}
                          {/* Delete button for DRAFT, SCHEDULED, FAILED */}
                          {['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status) && (
                            <form action={handleDeletePost}>
                              <input type="hidden" name="postId" value={post.id} />
                              <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" title="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </form>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
