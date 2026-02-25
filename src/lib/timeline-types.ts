/**
 * Multi-track timeline data model for the Studio editor.
 *
 * Inspired by DaVinci Resolve:
 *   - Multiple video/audio/text tracks stacked vertically
 *   - Clips positioned on tracks with start time, duration, media offset
 *   - Playhead, zoom, scroll state
 *   - Non-destructive: original media is never modified
 */

// ── Core Types ──────────────────────────────────────────────────────────────

export type TrackType = 'video' | 'audio' | 'text';

export interface TimelineClip {
  id: string;
  mediaId: string;           // Reference to media in the pool
  trackId: string;           // Which track this clip belongs to
  startTime: number;         // Position on timeline (seconds)
  duration: number;          // Visible duration on timeline (seconds)
  mediaOffset: number;       // Start offset within source media (for trimmed clips)
  mediaDuration: number;     // Full duration of the source media
  filename: string;          // Display name
  // Text clip fields (when on a text track)
  text?: string;
  textColor?: string;
  textPosition?: 'top' | 'center' | 'bottom';
}

export interface TimelineTrack {
  id: string;
  type: TrackType;
  name: string;              // e.g. "V1", "V2", "A1", "T1"
  clips: TimelineClip[];
  muted: boolean;
  locked: boolean;
  height: number;            // Track height in pixels
}

export interface TimelineState {
  tracks: TimelineTrack[];
  playheadPosition: number;  // Current time in seconds
  zoom: number;              // Pixels per second (controls horizontal scale)
  scrollLeft: number;        // Horizontal scroll offset in pixels
  totalDuration: number;     // Computed from rightmost clip edge
  selectedClipId: string | null;
  selectedTrackId: string | null;
  snapEnabled: boolean;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const MIN_ZOOM = 20;   // 20px per second (zoomed out)
export const MAX_ZOOM = 200;  // 200px per second (zoomed in)
export const DEFAULT_ZOOM = 60;

export const DEFAULT_TRACK_HEIGHT = 48;
export const TEXT_TRACK_HEIGHT = 36;
export const RULER_HEIGHT = 28;
export const TRACK_HEADER_WIDTH = 56;

export const SNAP_THRESHOLD_PX = 6; // Snap within 6 pixels

export const TRACK_COLORS: Record<TrackType, { bg: string; clip: string; clipSelected: string; border: string }> = {
  video: {
    bg: 'bg-blue-950/30',
    clip: 'bg-blue-600/80',
    clipSelected: 'bg-blue-500',
    border: 'border-blue-400/50',
  },
  audio: {
    bg: 'bg-green-950/30',
    clip: 'bg-green-600/80',
    clipSelected: 'bg-green-500',
    border: 'border-green-400/50',
  },
  text: {
    bg: 'bg-purple-950/30',
    clip: 'bg-purple-600/80',
    clipSelected: 'bg-purple-500',
    border: 'border-purple-400/50',
  },
};

// ── ID Generation ───────────────────────────────────────────────────────────

let _idCounter = 0;
export function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

// ── Default Timeline ────────────────────────────────────────────────────────

export function createDefaultTimeline(): TimelineState {
  return {
    tracks: [
      { id: genId('v'), type: 'video', name: 'V1', clips: [], muted: false, locked: false, height: DEFAULT_TRACK_HEIGHT },
      { id: genId('v'), type: 'video', name: 'V2', clips: [], muted: false, locked: false, height: DEFAULT_TRACK_HEIGHT },
      { id: genId('a'), type: 'audio', name: 'A1', clips: [], muted: false, locked: false, height: DEFAULT_TRACK_HEIGHT },
      { id: genId('t'), type: 'text', name: 'T1', clips: [], muted: false, locked: false, height: TEXT_TRACK_HEIGHT },
    ],
    playheadPosition: 0,
    zoom: DEFAULT_ZOOM,
    scrollLeft: 0,
    totalDuration: 0,
    selectedClipId: null,
    selectedTrackId: null,
    snapEnabled: true,
  };
}

// ── Utility Functions ───────────────────────────────────────────────────────

/** Compute the total duration from all clips across all tracks */
export function computeTotalDuration(tracks: TimelineTrack[]): number {
  let max = 0;
  for (const track of tracks) {
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration;
      if (end > max) max = end;
    }
  }
  // Add a small buffer for visual breathing room
  return Math.max(max + 2, 10);
}

/** Check if a new clip would overlap with existing clips on the same track */
export function wouldOverlap(
  track: TimelineTrack,
  startTime: number,
  duration: number,
  excludeClipId?: string,
): boolean {
  const end = startTime + duration;
  for (const clip of track.clips) {
    if (excludeClipId && clip.id === excludeClipId) continue;
    const clipEnd = clip.startTime + clip.duration;
    // Overlap if ranges intersect
    if (startTime < clipEnd && end > clip.startTime) return true;
  }
  return false;
}

/** Find the next available start time on a track (first gap that fits duration) */
export function findNextAvailableTime(track: TimelineTrack, duration: number): number {
  if (track.clips.length === 0) return 0;

  const sorted = [...track.clips].sort((a, b) => a.startTime - b.startTime);

  // Check if it fits before the first clip
  if (sorted[0].startTime >= duration) return 0;

  // Check gaps between clips
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].startTime + sorted[i].duration;
    const gapEnd = sorted[i + 1].startTime;
    if (gapEnd - gapStart >= duration) return gapStart;
  }

  // Append after last clip
  const last = sorted[sorted.length - 1];
  return last.startTime + last.duration;
}

/** Get snap points from all clips on all tracks */
export function getSnapPoints(tracks: TimelineTrack[], excludeClipId?: string): number[] {
  const points = new Set<number>();
  points.add(0); // Always snap to start
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (excludeClipId && clip.id === excludeClipId) continue;
      points.add(clip.startTime);
      points.add(clip.startTime + clip.duration);
    }
  }
  return Array.from(points).sort((a, b) => a - b);
}

/** Snap a time value to the nearest snap point if within threshold */
export function snapToPoint(
  time: number,
  snapPoints: number[],
  zoom: number,
  threshold: number = SNAP_THRESHOLD_PX,
): { time: number; snapped: boolean } {
  const thresholdSec = threshold / zoom;
  let nearest = time;
  let minDist = Infinity;
  for (const point of snapPoints) {
    const dist = Math.abs(time - point);
    if (dist < minDist && dist <= thresholdSec) {
      minDist = dist;
      nearest = point;
    }
  }
  return { time: nearest, snapped: nearest !== time };
}

/** Split a clip at a given time, returning two new clips (or null if outside bounds) */
export function splitClipAtTime(clip: TimelineClip, splitTime: number): [TimelineClip, TimelineClip] | null {
  const clipEnd = clip.startTime + clip.duration;
  // Must be within the clip (with some margin)
  if (splitTime <= clip.startTime + 0.1 || splitTime >= clipEnd - 0.1) return null;

  const firstDuration = splitTime - clip.startTime;
  const secondDuration = clipEnd - splitTime;

  const first: TimelineClip = {
    ...clip,
    id: genId('clip'),
    duration: firstDuration,
  };

  const second: TimelineClip = {
    ...clip,
    id: genId('clip'),
    startTime: splitTime,
    duration: secondDuration,
    mediaOffset: clip.mediaOffset + firstDuration,
  };

  return [first, second];
}

/** Format seconds as M:SS or H:MM:SS */
export function formatTimelineTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Get ordered V1 clips for export (sorted by startTime) */
export function getExportClips(tracks: TimelineTrack[]): TimelineClip[] {
  const v1 = tracks.find(t => t.name === 'V1');
  if (!v1) return [];
  return [...v1.clips].sort((a, b) => a.startTime - b.startTime);
}

/** Get text overlay clips for export */
export function getTextClips(tracks: TimelineTrack[]): TimelineClip[] {
  return tracks
    .filter(t => t.type === 'text')
    .flatMap(t => t.clips)
    .filter(c => c.text && c.text.trim())
    .sort((a, b) => a.startTime - b.startTime);
}
