'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AutopilotCustomPrompt } from './autopilot-custom-prompt';

interface Props {
  botId: string;
  platforms: string[];
  savedPrompt: string;
  saveAction: (formData: FormData) => Promise<void>;
}

export function AutopilotCustomPromptClient({ botId, platforms, savedPrompt, saveAction }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSavePrompt = useCallback((prompt: string) => {
    const fd = new FormData();
    fd.set('prompt', prompt);
    startTransition(async () => {
      await saveAction(fd);
      router.refresh();
    });
  }, [saveAction, router]);

  return (
    <AutopilotCustomPrompt
      botId={botId}
      platforms={platforms}
      savedPrompt={savedPrompt}
      onSavePrompt={handleSavePrompt}
    />
  );
}
