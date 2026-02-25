import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { StudioEditor } from '@/components/dashboard/studio-editor';

export const metadata: Metadata = {
  title: 'Studio',
  robots: { index: false },
};

export default async function BotStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const bot = await db.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) notFound();

  const videos = await db.media.findMany({
    where: {
      botId: bot.id,
      type: 'VIDEO',
      OR: [
        { generationStatus: null },
        { generationStatus: 'SUCCEEDED' },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      fileSize: true,
      width: true,
      height: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{bot.name} — Studio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Edit your videos — trim, add text overlays, and resize for any platform. Edited videos are saved to your Media library.
        </p>
      </div>

      <StudioEditor videos={videos} botId={bot.id} botPageId={id} />
    </div>
  );
}
