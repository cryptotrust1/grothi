'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AutopilotPostManager, type AutopilotPost } from './autopilot-post-manager';

interface Props {
  posts: AutopilotPost[];
  botId: string;
  botPageId: string;
  platformNames: Record<string, string>;
  approveAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  editAction: (formData: FormData) => Promise<void>;
}

export function AutopilotPostManagerClient({
  posts, botId, botPageId, platformNames,
  approveAction, deleteAction, editAction,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleApprove = useCallback((postId: string) => {
    const fd = new FormData();
    fd.set('postId', postId);
    startTransition(async () => {
      await approveAction(fd);
      router.refresh();
    });
  }, [approveAction, router]);

  const handleDelete = useCallback((postId: string) => {
    if (!confirm('Delete this post?')) return;
    const fd = new FormData();
    fd.set('postId', postId);
    startTransition(async () => {
      await deleteAction(fd);
      router.refresh();
    });
  }, [deleteAction, router]);

  const handleEdit = useCallback((postId: string, content: string) => {
    const fd = new FormData();
    fd.set('postId', postId);
    fd.set('content', content);
    startTransition(async () => {
      await editAction(fd);
      router.refresh();
    });
  }, [editAction, router]);

  return (
    <AutopilotPostManager
      posts={posts}
      botId={botId}
      botPageId={botPageId}
      platformNames={platformNames}
      onApprove={handleApprove}
      onDelete={handleDelete}
      onEdit={handleEdit}
    />
  );
}
