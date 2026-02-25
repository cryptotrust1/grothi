'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Lock, Unlock, Volume2, VolumeX, Scissors, Plus,
  Trash2, ZoomIn, ZoomOut, Magnet, ChevronDown,
  GripVertical, Eye, EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type TimelineState,
  type TimelineTrack,
  type TimelineClip,
  type TrackType,
  RULER_HEIGHT,
  TRACK_HEADER_WIDTH,
  TRACK_COLORS,
  MIN_ZOOM,
  MAX_ZOOM,
  SNAP_THRESHOLD_PX,
  formatTimelineTime,
  getSnapPoints,
  snapToPoint,
  wouldOverlap,
  computeTotalDuration,
} from '@/lib/timeline-types';

// ── Types ───────────────────────────────────────────────────────────────────

interface StudioTimelineProps {
  timeline: TimelineState;
  isPlaying: boolean;
  onTimelineChange: (timeline: TimelineState) => void;
  onPlayheadChange: (time: number) => void;
  onClipSelect: (clipId: string | null) => void;
  onClipDelete: (clipId: string) => void;
  onClipSplit: (clipId: string, time: number) => void;
  onAddTrack: (type: TrackType) => void;
  onTogglePlay: () => void;
}

type DragMode = 'move' | 'resize-left' | 'resize-right' | null;

interface DragState {
  mode: DragMode;
  clipId: string;
  trackId: string;
  startX: number;
  originalStartTime: number;
  originalDuration: number;
  originalMediaOffset: number;
}

// ── Component ───────────────────────────────────────────────────────────────

export function StudioTimeline({
  timeline,
  isPlaying,
  onTimelineChange,
  onPlayheadChange,
  onClipSelect,
  onClipDelete,
  onClipSplit,
  onAddTrack,
  onTogglePlay,
}: StudioTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState<number | null>(null);
  const [showAddTrack, setShowAddTrack] = useState(false);

  const { tracks, zoom, scrollLeft, selectedClipId, snapEnabled } = timeline;
  const totalDuration = timeline.totalDuration;

  // Total width of the timeline content
  const timelineWidth = Math.max(totalDuration * zoom, 600);

  // ── Ruler tick marks ────────────────────────────────────────────────────
  const rulerTicks = useMemo(() => {
    // Choose tick interval based on zoom level
    let interval: number;
    if (zoom >= 120) interval = 1;       // Every 1s
    else if (zoom >= 60) interval = 2;   // Every 2s
    else if (zoom >= 30) interval = 5;   // Every 5s
    else interval = 10;                   // Every 10s

    const ticks: { time: number; major: boolean }[] = [];
    for (let t = 0; t <= totalDuration; t += interval) {
      ticks.push({ time: t, major: true });
      // Add minor ticks
      if (interval >= 5 && zoom >= 30) {
        for (let m = 1; m < 5 && t + m * (interval / 5) < totalDuration; m++) {
          ticks.push({ time: t + m * (interval / 5), major: false });
        }
      }
    }
    return ticks;
  }, [totalDuration, zoom]);

  // ── Coordinate helpers ──────────────────────────────────────────────────

  const timeToX = useCallback((time: number) => time * zoom, [zoom]);
  const xToTime = useCallback((x: number) => Math.max(0, x / zoom), [zoom]);

  const getTimeFromPointer = useCallback((clientX: number): number => {
    if (!scrollRef.current) return 0;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current.scrollLeft;
    return Math.max(0, x / zoom);
  }, [zoom]);

  // ── Playhead scrubbing ──────────────────────────────────────────────────

  const handleRulerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setScrubbing(true);
    const time = getTimeFromPointer(e.clientX);
    onPlayheadChange(time);
  }, [getTimeFromPointer, onPlayheadChange]);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => {
      const time = getTimeFromPointer(e.clientX);
      onPlayheadChange(time);
    };
    const onUp = () => setScrubbing(false);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [scrubbing, getTimeFromPointer, onPlayheadChange]);

  // ── Clip dragging ───────────────────────────────────────────────────────

  const handleClipPointerDown = useCallback((
    e: React.PointerEvent,
    clip: TimelineClip,
    mode: DragMode,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    onClipSelect(clip.id);
    if (!mode) return;

    setDragState({
      mode,
      clipId: clip.id,
      trackId: clip.trackId,
      startX: e.clientX,
      originalStartTime: clip.startTime,
      originalDuration: clip.duration,
      originalMediaOffset: clip.mediaOffset,
    });
  }, [onClipSelect]);

  useEffect(() => {
    if (!dragState) return;

    const onMove = (e: PointerEvent) => {
      const deltaX = e.clientX - dragState.startX;
      const deltaTime = deltaX / zoom;

      const newTimeline = { ...timeline, tracks: timeline.tracks.map(t => ({ ...t, clips: [...t.clips] })) };
      const track = newTimeline.tracks.find(t => t.id === dragState.trackId);
      if (!track) return;

      const clipIdx = track.clips.findIndex(c => c.id === dragState.clipId);
      if (clipIdx === -1) return;

      const clip = { ...track.clips[clipIdx] };

      if (dragState.mode === 'move') {
        let newStart = Math.max(0, dragState.originalStartTime + deltaTime);

        // Snap
        if (snapEnabled) {
          const snapPoints = getSnapPoints(newTimeline.tracks, clip.id);
          // Snap start edge
          const snapStart = snapToPoint(newStart, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (snapStart.snapped) {
            newStart = snapStart.time;
            setSnapIndicator(newStart);
          } else {
            // Snap end edge
            const snapEnd = snapToPoint(newStart + clip.duration, snapPoints, zoom, SNAP_THRESHOLD_PX);
            if (snapEnd.snapped) {
              newStart = snapEnd.time - clip.duration;
              setSnapIndicator(snapEnd.time);
            } else {
              setSnapIndicator(null);
            }
          }
        }

        // Check overlap
        if (!wouldOverlap(track, newStart, clip.duration, clip.id)) {
          clip.startTime = newStart;
        }
      } else if (dragState.mode === 'resize-left') {
        let newStart = Math.max(0, dragState.originalStartTime + deltaTime);
        const originalEnd = dragState.originalStartTime + dragState.originalDuration;
        const minDuration = 0.2;

        // Snap left edge
        if (snapEnabled) {
          const snapPoints = getSnapPoints(newTimeline.tracks, clip.id);
          const snap = snapToPoint(newStart, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (snap.snapped) {
            newStart = snap.time;
            setSnapIndicator(newStart);
          } else {
            setSnapIndicator(null);
          }
        }

        // Clamp: don't go past original end, and don't go before media start
        const maxMediaTrim = dragState.originalMediaOffset + (dragState.originalStartTime - newStart);
        if (maxMediaTrim < 0) newStart = dragState.originalStartTime + dragState.originalMediaOffset;
        if (originalEnd - newStart < minDuration) newStart = originalEnd - minDuration;

        if (!wouldOverlap(track, newStart, originalEnd - newStart, clip.id)) {
          const trimDelta = newStart - dragState.originalStartTime;
          clip.startTime = newStart;
          clip.duration = originalEnd - newStart;
          clip.mediaOffset = dragState.originalMediaOffset + trimDelta;
        }
      } else if (dragState.mode === 'resize-right') {
        let newEnd = dragState.originalStartTime + dragState.originalDuration + deltaTime;
        const minDuration = 0.2;

        // Snap right edge
        if (snapEnabled) {
          const snapPoints = getSnapPoints(newTimeline.tracks, clip.id);
          const snap = snapToPoint(newEnd, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (snap.snapped) {
            newEnd = snap.time;
            setSnapIndicator(newEnd);
          } else {
            setSnapIndicator(null);
          }
        }

        // Clamp: minimum duration, and can't extend past media length
        const maxDuration = clip.mediaDuration - clip.mediaOffset;
        let newDuration = newEnd - clip.startTime;
        if (newDuration < minDuration) newDuration = minDuration;
        if (newDuration > maxDuration) newDuration = maxDuration;

        if (!wouldOverlap(track, clip.startTime, newDuration, clip.id)) {
          clip.duration = newDuration;
        }
      }

      track.clips[clipIdx] = clip;
      newTimeline.totalDuration = computeTotalDuration(newTimeline.tracks);
      onTimelineChange(newTimeline);
    };

    const onUp = () => {
      setDragState(null);
      setSnapIndicator(null);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [dragState, zoom, timeline, snapEnabled, onTimelineChange]);

  // ── Zoom ────────────────────────────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    onTimelineChange({ ...timeline, zoom: Math.min(MAX_ZOOM, zoom * 1.3) });
  }, [timeline, zoom, onTimelineChange]);

  const handleZoomOut = useCallback(() => {
    onTimelineChange({ ...timeline, zoom: Math.max(MIN_ZOOM, zoom / 1.3) });
  }, [timeline, zoom, onTimelineChange]);

  const handleToggleSnap = useCallback(() => {
    onTimelineChange({ ...timeline, snapEnabled: !snapEnabled });
  }, [timeline, snapEnabled, onTimelineChange]);

  // ── Track actions ───────────────────────────────────────────────────────

  const handleToggleMute = useCallback((trackId: string) => {
    onTimelineChange({
      ...timeline,
      tracks: tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t),
    });
  }, [timeline, tracks, onTimelineChange]);

  const handleToggleLock = useCallback((trackId: string) => {
    onTimelineChange({
      ...timeline,
      tracks: tracks.map(t => t.id === trackId ? { ...t, locked: !t.locked } : t),
    });
  }, [timeline, tracks, onTimelineChange]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          onClipDelete(selectedClipId);
        }
      }
      if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) {
        // Split at playhead
        if (selectedClipId) {
          e.preventDefault();
          onClipSplit(selectedClipId, timeline.playheadPosition);
        }
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        handleZoomIn();
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        handleZoomOut();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, timeline.playheadPosition, onTogglePlay, onClipDelete, onClipSplit, handleZoomIn, handleZoomOut]);

  // ── Auto-scroll to playhead during playback ─────────────────────────────

  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const playheadX = timeToX(timeline.playheadPosition);
    const container = scrollRef.current;
    const viewLeft = container.scrollLeft;
    const viewRight = viewLeft + container.clientWidth;
    if (playheadX < viewLeft + 50 || playheadX > viewRight - 50) {
      container.scrollLeft = Math.max(0, playheadX - container.clientWidth / 3);
    }
  }, [isPlaying, timeline.playheadPosition, timeToX]);

  // ── Click on track area to deselect ─────────────────────────────────────

  const handleTrackAreaClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-clip]')) return;
    onClipSelect(null);
    // Move playhead
    const time = getTimeFromPointer(e.clientX);
    onPlayheadChange(time);
  }, [onClipSelect, getTimeFromPointer, onPlayheadChange]);

  // ── Render ────────────────────────────────────────────────────────────────

  const playheadX = timeToX(timeline.playheadPosition);

  return (
    <div ref={containerRef} className="flex flex-col bg-gray-950 border-t border-white/10 select-none"
      style={{ minHeight: `${RULER_HEIGHT + tracks.length * 56 + 36}px` }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-white/10 bg-gray-900/80 shrink-0">
        <Button size="sm" variant="ghost" onClick={handleZoomOut}
          className="text-white/60 hover:bg-white/10 hover:text-white h-6 w-6 p-0" title="Zoom out (-)">
          <ZoomOut className="h-3 w-3" />
        </Button>
        <div className="w-16 text-center text-[10px] text-white/40 tabular-nums">
          {Math.round(zoom)}px/s
        </div>
        <Button size="sm" variant="ghost" onClick={handleZoomIn}
          className="text-white/60 hover:bg-white/10 hover:text-white h-6 w-6 p-0" title="Zoom in (+)">
          <ZoomIn className="h-3 w-3" />
        </Button>

        <div className="w-px h-4 bg-white/10 mx-1" />

        <Button size="sm" variant="ghost" onClick={handleToggleSnap}
          className={`h-6 px-1.5 gap-1 text-[10px] ${snapEnabled ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-white/40 hover:bg-white/10'}`}
          title="Toggle snapping (N)">
          <Magnet className="h-3 w-3" />
          Snap
        </Button>

        <div className="w-px h-4 bg-white/10 mx-1" />

        {selectedClipId && (
          <>
            <Button size="sm" variant="ghost"
              onClick={() => onClipSplit(selectedClipId, timeline.playheadPosition)}
              className="text-white/60 hover:bg-white/10 hover:text-white h-6 px-1.5 gap-1 text-[10px]"
              title="Split at playhead (S)">
              <Scissors className="h-3 w-3" />
              Split
            </Button>
            <Button size="sm" variant="ghost"
              onClick={() => onClipDelete(selectedClipId)}
              className="text-white/60 hover:bg-red-400/10 hover:text-red-400 h-6 px-1.5 gap-1 text-[10px]"
              title="Delete clip (Del)">
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
            <div className="w-px h-4 bg-white/10 mx-1" />
          </>
        )}

        <div className="flex-1" />

        <span className="text-[10px] text-white/50 tabular-nums font-mono">
          {formatTimelineTime(timeline.playheadPosition)} / {formatTimelineTime(totalDuration)}
        </span>

        <div className="w-px h-4 bg-white/10 mx-1" />

        <div className="relative">
          <Button size="sm" variant="ghost"
            onClick={() => setShowAddTrack(v => !v)}
            className="text-white/60 hover:bg-white/10 hover:text-white h-6 px-1.5 gap-1 text-[10px]">
            <Plus className="h-3 w-3" />
            Track
            <ChevronDown className="h-2.5 w-2.5" />
          </Button>
          {showAddTrack && (
            <div className="absolute right-0 top-full mt-1 bg-gray-800 border border-white/10 rounded-md shadow-xl z-50 py-1 min-w-[120px]">
              {(['video', 'audio', 'text'] as TrackType[]).map(type => (
                <button key={type}
                  onClick={() => { onAddTrack(type); setShowAddTrack(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10 capitalize">
                  {type} Track
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Timeline area ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Track headers (fixed left column) ── */}
        <div className="shrink-0 flex flex-col bg-gray-900/60 border-r border-white/10"
          style={{ width: TRACK_HEADER_WIDTH }}>
          {/* Ruler spacer */}
          <div style={{ height: RULER_HEIGHT }} className="border-b border-white/10" />
          {/* Track headers */}
          {tracks.map(track => (
            <div key={track.id}
              style={{ height: track.height + 8 }}
              className={`flex flex-col justify-center px-1.5 border-b border-white/5 ${
                timeline.selectedTrackId === track.id ? 'bg-white/5' : ''
              }`}>
              <div className="flex items-center gap-0.5">
                <GripVertical className="h-2.5 w-2.5 text-white/20 shrink-0" />
                <span className={`text-[10px] font-bold ${
                  track.type === 'video' ? 'text-blue-400' :
                    track.type === 'audio' ? 'text-green-400' : 'text-purple-400'
                }`}>{track.name}</span>
              </div>
              <div className="flex items-center gap-0.5 mt-0.5">
                <button onClick={() => handleToggleMute(track.id)}
                  className={`p-0.5 rounded ${track.muted ? 'text-red-400' : 'text-white/30 hover:text-white/60'}`}
                  title={track.muted ? 'Unmute' : 'Mute'}>
                  {track.muted ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
                </button>
                <button onClick={() => handleToggleLock(track.id)}
                  className={`p-0.5 rounded ${track.locked ? 'text-yellow-400' : 'text-white/30 hover:text-white/60'}`}
                  title={track.locked ? 'Unlock' : 'Lock'}>
                  {track.locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Scrollable timeline content ── */}
        <div ref={scrollRef} className="flex-1 overflow-x-auto overflow-y-hidden relative"
          onClick={handleTrackAreaClick}>

          <div style={{ width: timelineWidth, position: 'relative' }}>

            {/* ── Ruler ── */}
            <div style={{ height: RULER_HEIGHT }}
              className="border-b border-white/10 bg-gray-900/40 cursor-pointer sticky top-0 z-10"
              onPointerDown={handleRulerPointerDown}>
              {rulerTicks.map((tick, i) => (
                <div key={i} className="absolute top-0 bottom-0" style={{ left: timeToX(tick.time) }}>
                  <div className={`absolute bottom-0 w-px ${tick.major ? 'h-3 bg-white/30' : 'h-1.5 bg-white/15'}`} />
                  {tick.major && (
                    <span className="absolute top-0.5 text-[9px] text-white/40 tabular-nums font-mono -translate-x-1/2 select-none">
                      {formatTimelineTime(tick.time)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Tracks ── */}
            {tracks.map(track => {
              const colors = TRACK_COLORS[track.type];
              return (
                <div key={track.id}
                  style={{ height: track.height + 8 }}
                  className={`relative border-b border-white/5 ${colors.bg}`}>

                  {/* Clips */}
                  {track.clips.map(clip => {
                    const left = timeToX(clip.startTime);
                    const width = Math.max(timeToX(clip.duration), 4);
                    const isSelected = selectedClipId === clip.id;
                    const isDragging = dragState?.clipId === clip.id;

                    return (
                      <div key={clip.id} data-clip
                        className={`absolute top-1 rounded-[3px] overflow-hidden cursor-pointer transition-shadow ${
                          isSelected ? `${colors.clipSelected} ring-1 ring-white/60 shadow-lg` : `${colors.clip} hover:ring-1 hover:ring-white/30`
                        } ${isDragging ? 'opacity-90 shadow-xl' : ''} ${track.locked ? 'opacity-50 pointer-events-none' : ''}`}
                        style={{
                          left,
                          width,
                          height: track.height,
                        }}
                        onPointerDown={(e) => handleClipPointerDown(e, clip, 'move')}>

                        {/* Resize handle left */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
                          onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, 'resize-left'); }} />

                        {/* Clip content */}
                        <div className="px-1.5 py-0.5 h-full flex flex-col justify-center overflow-hidden pointer-events-none">
                          <span className="text-[9px] font-medium text-white truncate leading-tight">
                            {clip.text || clip.filename}
                          </span>
                          {width > 60 && (
                            <span className="text-[8px] text-white/50 tabular-nums truncate">
                              {formatTimelineTime(clip.duration)}
                            </span>
                          )}
                        </div>

                        {/* Waveform-style decoration for audio clips */}
                        {track.type === 'audio' && (
                          <div className="absolute inset-x-0 bottom-0 h-3 flex items-end gap-px px-1 pointer-events-none opacity-30">
                            {Array.from({ length: Math.min(Math.floor(width / 3), 50) }).map((_, i) => (
                              <div key={i} className="flex-1 bg-green-300 rounded-t-sm"
                                style={{ height: `${20 + Math.sin(i * 0.7) * 40 + Math.random() * 40}%` }} />
                            ))}
                          </div>
                        )}

                        {/* Resize handle right */}
                        <div className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30 z-10"
                          onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, 'resize-right'); }} />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* ── Playhead (spans full height) ── */}
            <div className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{ left: playheadX }}>
              {/* Playhead marker */}
              <div className="relative">
                <svg width="10" height="10" viewBox="0 0 10 10" className="absolute -left-[5px] top-0">
                  <polygon points="0,0 10,0 5,8" fill="#ef4444" />
                </svg>
              </div>
              {/* Playhead line */}
              <div className="w-px h-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
            </div>

            {/* ── Snap indicator ── */}
            {snapIndicator !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-yellow-400/60 z-20 pointer-events-none"
                style={{ left: timeToX(snapIndicator) }} />
            )}
          </div>
        </div>
      </div>

      {/* ── Keyboard shortcuts hint ── */}
      <div className="flex items-center gap-3 px-2 py-1 border-t border-white/10 bg-gray-900/60 shrink-0">
        <span className="text-[9px] text-white/30">
          Space: Play/Pause &nbsp; S: Split &nbsp; Del: Delete &nbsp; +/-: Zoom &nbsp; Drag clips to move/resize
        </span>
      </div>
    </div>
  );
}
