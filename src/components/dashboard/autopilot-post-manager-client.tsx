'use client';

import { useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AutopilotPostManager, type AutopilotPost, type MediaItem } from './autopilot-post-manager';

interface Props {
  posts: AutopilotPost[];
  botId: string;
  botPageId: string;
  platformNames: Record<string, string>;
  availableMedia: MediaItem[];
  approveAction: (formData: FormData) => Promise<void>;
  deleteAction: (formData: FormData) => Promise<void>;
  editAction: (formData: FormData) => Promise<void>;
  changeMediaAction: (formData: FormData) => Promise<void>;
}

export function AutopilotPostManagerClient({
  posts, botId, botPageId, platformNames, availableMedia,
  approveAction, deleteAction, editAction, changeMediaAction,
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

  const handleChangeMedia = useCallback((postId: string, mediaId: string | null) => {
    const fd = new FormData();
    fd.set('postId', postId);
    fd.set('mediaId', mediaId || '');
    startTransition(async () => {
      await changeMediaAction(fd);
      router.refresh();
    });
  }, [changeMediaAction, router]);

  return (
    <AutopilotPostManager
      posts={posts}
      botId={botId}
      botPageId={botPageId}
      platformNames={platformNames}
      availableMedia={availableMedia}
      onApprove={handleApprove}
      onDelete={handleDelete}
      onEdit={handleEdit}
      onChangeMedia={handleChangeMedia}
    />
  );
}
