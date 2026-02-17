'use client';

interface MediaVideoThumbnailProps {
  src: string;
  className?: string;
}

export function MediaVideoThumbnail({ src, className }: MediaVideoThumbnailProps) {
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      src={src}
      className={className}
      muted
      preload="metadata"
      onMouseEnter={(e) => { const v = e.currentTarget; v.currentTime = 0; v.play().catch(() => {}); }}
      onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
    />
  );
}
