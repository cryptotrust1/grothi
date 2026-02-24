import { redirect } from 'next/navigation';

/**
 * Scheduler page has been consolidated into New Post (/post).
 * This redirect preserves any existing bookmarks or links.
 */
export default async function SchedulerRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/bots/${id}/post`);
}
