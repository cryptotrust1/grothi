import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { deductCredits, getActionCost, hasEnoughCredits } from '@/lib/credits';
import { PLATFORM_NAMES, PLATFORM_REQUIREMENTS, POST_STATUS_COLORS } from '@/lib/constants';
import { BotNav } from '@/components/dashboard/bot-nav';
import { PostFormClient } from '@/components/dashboard/post-form-client';

export const metadata: Metadata = { title: 'Create Post', robots: { index: false } };

export default async function ManualPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    success?: string;
    error?: string;
    mediaId?: string;
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

  // Recent posts for reference
  const recentPosts = await db.scheduledPost.findMany({
    where: { botId: bot.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { media: { select: { id: true, filename: true, type: true } } },
  });

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
    const action = formData.get('action') as string;
    const scheduledAt = formData.get('scheduledAt') as string;

    // Validate media ownership
    if (mediaId) {
      const media = await db.media.findFirst({ where: { id: mediaId, botId: id } });
      if (!media) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent('Media not found')}`);
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

    // Deduct credits for immediate post
    if (action === 'now') {
      const cost = await getActionCost('POST');
      const totalCost = cost * platformsRaw.length;
      const hasCredits = await hasEnoughCredits(currentUser.id, totalCost);
      if (!hasCredits) {
        redirect(`/dashboard/bots/${id}/post?error=${encodeURIComponent(`Not enough credits. Need ${totalCost} credits (${cost} per platform x ${platformsRaw.length} platforms).`)}`);
      }
      await deductCredits(
        currentUser.id,
        totalCost,
        `Manual post to ${platformsRaw.length} platform(s)`,
        id
      );
    }

    await db.scheduledPost.create({
      data: {
        botId: id,
        content,
        contentType: 'custom',
        mediaId,
        platforms: platformsRaw,
        scheduledAt: finalScheduledAt,
        autoSchedule: false,
        status: finalStatus,
      },
    });

    const actionLabel = action === 'now'
      ? 'Post queued for immediate publishing!'
      : action === 'schedule'
        ? 'Post scheduled successfully!'
        : 'Post saved as draft.';

    redirect(`/dashboard/bots/${id}/post?success=${encodeURIComponent(actionLabel)}`);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} - New Post</h1>
        <p className="text-sm text-muted-foreground mt-1">Create and publish a manual post to your connected platforms.</p>
        <BotNav botId={id} activeTab="post" />
      </div>

      <form action={handleCreatePost} id="post-form" className="hidden" />

      <PostFormClient
        botId={id}
        botName={bot.name}
        connectedPlatforms={connectedPlatforms}
        platformRequirements={PLATFORM_REQUIREMENTS}
        platformNames={PLATFORM_NAMES}
        postStatusColors={POST_STATUS_COLORS}
        mediaLibrary={serializedMediaLibrary}
        recentPosts={serializedRecentPosts}
        postCost={postCost}
        userCredits={userCredits}
        preSelectedMediaId={sp.mediaId || null}
        successMessage={sp.success || null}
        errorMessage={sp.error || null}
      />
    </div>
  );
}
