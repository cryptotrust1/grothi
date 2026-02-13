'use client';

import { useState } from 'react';

const PLATFORM_CHAR_LIMITS: Record<string, number> = {
  TWITTER: 280,
  MASTODON: 500,
  LINKEDIN: 3000,
  INSTAGRAM: 2200,
  THREADS: 500,
  FACEBOOK: 63206,
  BLUESKY: 300,
  TELEGRAM: 4096,
  DISCORD: 2000,
  PINTEREST: 500,
  REDDIT: 40000,
  MEDIUM: 100000,
  DEVTO: 100000,
  YOUTUBE: 5000,
  TIKTOK: 2200,
  NOSTR: 65535,
  MOLTBOOK: 5000,
};

/** Character counter for post content with platform limit warnings */
export function PostCharCounter({ platforms }: { platforms: string[] }) {
  const [count, setCount] = useState(0);

  const overLimits = platforms
    .filter((p) => PLATFORM_CHAR_LIMITS[p] && count > PLATFORM_CHAR_LIMITS[p])
    .map((p) => ({ platform: p, limit: PLATFORM_CHAR_LIMITS[p] }));

  return (
    <div className="text-xs text-muted-foreground">
      <span className={overLimits.length > 0 ? 'text-destructive font-medium' : ''}>
        {count} characters
      </span>
      {overLimits.length > 0 && (
        <span className="text-destructive ml-1">
          — exceeds limit for: {overLimits.map((o) => `${o.platform} (${o.limit})`).join(', ')}
        </span>
      )}
    </div>
  );
}

/** Delete confirmation that prevents accidental clicks */
export function SchedulerDeleteButton({
  postId,
  action,
}: {
  postId: string;
  action: (formData: FormData) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <form action={action} className="flex items-center gap-1">
        <input type="hidden" name="postId" value={postId} />
        <button
          type="submit"
          className="text-xs text-destructive font-medium hover:underline"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-xs text-muted-foreground hover:underline"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="text-muted-foreground hover:text-destructive transition-colors"
      title="Delete post"
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}
