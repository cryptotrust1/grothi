'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Lock, Unlock, Volume2, VolumeX, Scissors, Plus,
  Trash2, ZoomIn, ZoomOut, Magnet, ChevronDown,
  GripVertical, Eye, EyeOff, MousePointer2, Move,
  SkipBack, SkipForward, Play, Pause,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  type TimelineState,
  type TimelineTrack,
  type TimelineClip,
  type TrackType,
  type TimelineTool,
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
  const [razorHoverTime, setRazorHoverTime] = useState<number | null>(null);

  const { tracks, zoom, selectedClipId, snapEnabled, activeTool } = timeline;
  const totalDuration = timeline.totalDuration;

  // Total width of the timeline content
  const timelineWidth = Math.max(totalDuration * zoom, 800);

  // ── Ruler tick marks (DaVinci Resolve style) ─────────────────────────────
  // At high zoom: show every second with 10 sub-ticks (like frames)
  // At medium zoom: show every 2-5 seconds with sub-ticks
  // At low zoom: show every 10-30 seconds
  const rulerTicks = useMemo(() => {
    // Calculate the major interval based on zoom
    // Goal: major tick labels should be ~80-120px apart
    const idealPxBetweenLabels = 100;
    const rawInterval = idealPxBetweenLabels / zoom;

    // Snap to nice intervals: 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300...
    const niceIntervals = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    let majorInterval = niceIntervals[niceIntervals.length - 1];
    for (const ni of niceIntervals) {
      if (ni >= rawInterval) { majorInterval = ni; break; }
    }

    // Sub-division count: how many sub-ticks between major ticks
    let subDivisions: number;
    if (majorInterval <= 1) subDivisions = 10; // Show 10ths of second (frame-like)
    else if (majorInterval <= 2) subDivisions = majorInterval === 2 ? 4 : 5;
    else if (majorInterval <= 5) subDivisions = 5;
    else if (majorInterval <= 10) subDivisions = 10;
    else if (majorInterval <= 30) subDivisions = 6;
    else subDivisions = 4;

    const subInterval = majorInterval / subDivisions;
    const visibleEnd = totalDuration + 5;

    const ticks: { time: number; type: 'major' | 'mid' | 'minor' }[] = [];
    for (let t = 0; t <= visibleEnd; t = Math.round((t + subInterval) * 1000) / 1000) {
      const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs(t % majorInterval - majorInterval) < 0.001;
      const isMid = !isMajor && subDivisions >= 4 && Math.abs((t / subInterval) % (subDivisions / 2)) < 0.001;
      ticks.push({ time: t, type: isMajor ? 'major' : isMid ? 'mid' : 'minor' });
    }
    return ticks;
  }, [totalDuration, zoom]);

  // ── Coordinate helpers ──────────────────────────────────────────────────

  const timeToX = useCallback((time: number) => time * zoom, [zoom]);

  const getTimeFromPointer = useCallback((clientX: number): number => {
    if (!scrollRef.current) return 0;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = clientX - rect.left + scrollRef.current.scrollLeft;
    return Math.max(0, x / zoom);
  }, [zoom]);

  // ── Tool change ──────────────────────────────────────────────────────────

  const handleSetTool = useCallback((tool: TimelineTool) => {
    onTimelineChange({ ...timeline, activeTool: tool });
  }, [timeline, onTimelineChange]);

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

    // Razor tool: split clip at click position
    if (activeTool === 'razor') {
      const time = getTimeFromPointer(e.clientX);
      onClipSplit(clip.id, time);
      return;
    }

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
  }, [onClipSelect, activeTool, getTimeFromPointer, onClipSplit]);

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
          // Add playhead as snap point
          snapPoints.push(timeline.playheadPosition);
          const snapStart = snapToPoint(newStart, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (snapStart.snapped) {
            newStart = snapStart.time;
            setSnapIndicator(newStart);
          } else {
            const snapEnd = snapToPoint(newStart + clip.duration, snapPoints, zoom, SNAP_THRESHOLD_PX);
            if (snapEnd.snapped) {
              newStart = snapEnd.time - clip.duration;
              setSnapIndicator(snapEnd.time);
            } else {
              setSnapIndicator(null);
            }
          }
        }

        if (!wouldOverlap(track, newStart, clip.duration, clip.id)) {
          clip.startTime = newStart;
        }
      } else if (dragState.mode === 'resize-left') {
        let newStart = Math.max(0, dragState.originalStartTime + deltaTime);
        const originalEnd = dragState.originalStartTime + dragState.originalDuration;
        const minDuration = 0.1;

        if (snapEnabled) {
          const snapPoints = getSnapPoints(newTimeline.tracks, clip.id);
          snapPoints.push(timeline.playheadPosition);
          const snap = snapToPoint(newStart, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (snap.snapped) {
            newStart = snap.time;
            setSnapIndicator(newStart);
          } else {
            setSnapIndicator(null);
          }
        }

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
        const minDuration = 0.1;

        if (snapEnabled) {
          const snapPoints = getSnapPoints(newTimeline.tracks, clip.id);
          snapPoints.push(timeline.playheadPosition);
          const snap = snapToPoint(newEnd, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (snap.snapped) {
            newEnd = snap.time;
            setSnapIndicator(newEnd);
          } else {
            setSnapIndicator(null);
          }
        }

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

  // ── Zoom (mouse wheel + buttons) ────────────────────────────────────────

  const handleZoomIn = useCallback(() => {
    onTimelineChange({ ...timeline, zoom: Math.min(MAX_ZOOM, zoom * 1.25) });
  }, [timeline, zoom, onTimelineChange]);

  const handleZoomOut = useCallback(() => {
    onTimelineChange({ ...timeline, zoom: Math.max(MIN_ZOOM, zoom / 1.25) });
  }, [timeline, zoom, onTimelineChange]);

  // Mouse wheel zoom (Ctrl+Scroll or Alt+Scroll)
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + container.scrollLeft;
        const timeAtMouse = mouseX / zoom;

        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));

        // Keep the time under the mouse cursor in the same screen position
        const newScrollLeft = timeAtMouse * newZoom - (e.clientX - rect.left);

        onTimelineChange({
          ...timeline,
          zoom: newZoom,
          scrollLeft: Math.max(0, newScrollLeft),
        });

        container.scrollLeft = Math.max(0, newScrollLeft);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [zoom, timeline, onTimelineChange]);

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

  const handleDeleteTrack = useCallback((trackId: string) => {
    if (tracks.length <= 1) return;
    onTimelineChange({
      ...timeline,
      tracks: tracks.filter(t => t.id !== trackId),
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
      // B = Razor tool (like DaVinci Resolve)
      if (e.code === 'KeyB') {
        e.preventDefault();
        handleSetTool(activeTool === 'razor' ? 'select' : 'razor');
      }
      // A = Select tool
      if (e.code === 'KeyA' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSetTool('select');
      }
      // T = Trim tool
      if (e.code === 'KeyT' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        handleSetTool('trim');
      }
      // S = Split at playhead (all clips under playhead)
      if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey) {
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
      // J/K/L shuttle (like DaVinci Resolve)
      if (e.code === 'KeyJ') {
        e.preventDefault();
        onPlayheadChange(Math.max(0, timeline.playheadPosition - 1));
      }
      if (e.code === 'KeyK') {
        e.preventDefault();
        if (isPlaying) onTogglePlay();
      }
      if (e.code === 'KeyL') {
        e.preventDefault();
        onPlayheadChange(timeline.playheadPosition + 1);
      }
      // Left/Right arrow = frame step
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        onPlayheadChange(Math.max(0, timeline.playheadPosition - (e.shiftKey ? 1 : 1/30)));
      }
      if (e.code === 'ArrowRight') {
        e.preventDefault();
        onPlayheadChange(timeline.playheadPosition + (e.shiftKey ? 1 : 1/30));
      }
      // Home/End
      if (e.code === 'Home') {
        e.preventDefault();
        onPlayheadChange(0);
      }
      if (e.code === 'End') {
        e.preventDefault();
        onPlayheadChange(totalDuration - 2);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, timeline.playheadPosition, isPlaying, activeTool, totalDuration,
      onTogglePlay, onClipDelete, onClipSplit, onPlayheadChange,
      handleZoomIn, handleZoomOut, handleSetTool]);

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

  // ── Razor hover indicator ────────────────────────────────────────────────

  const handleTrackAreaMouseMove = useCallback((e: React.MouseEvent) => {
    if (activeTool === 'razor') {
      const time = getTimeFromPointer(e.clientX);
      setRazorHoverTime(time);
    } else {
      setRazorHoverTime(null);
    }
  }, [activeTool, getTimeFromPointer]);

  const handleTrackAreaMouseLeave = useCallback(() => {
    setRazorHoverTime(null);
  }, []);

  // ── Click on track area ────────────────────────────────────────────────

  const handleTrackAreaClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-clip]')) return;
    onClipSelect(null);
    const time = getTimeFromPointer(e.clientX);
    onPlayheadChange(time);
  }, [onClipSelect, getTimeFromPointer, onPlayheadChange]);

  // ── Zoom slider value (for the visual indicator) ──────────────────────

  const zoomPercent = Math.round(((Math.log(zoom) - Math.log(MIN_ZOOM)) / (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM))) * 100);

  // ── Render ────────────────────────────────────────────────────────────────

  const playheadX = timeToX(timeline.playheadPosition);
  const totalTrackHeight = tracks.reduce((sum, t) => sum + t.height + 8, 0);

  // Tool cursor styles
  const trackCursor = activeTool === 'razor' ? 'cursor-crosshair'
    : activeTool === 'trim' ? 'cursor-col-resize' : 'cursor-default';

  return (
    <div ref={containerRef} className="flex flex-col bg-[#1a1a2e] select-none"
      style={{ minHeight: `${RULER_HEIGHT + totalTrackHeight + 80}px` }}>

      {/* ══════════ TOOLBAR (DaVinci Resolve style) ══════════ */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#333] bg-[#1e1e32] shrink-0">

        {/* ── Tool selection (left group) ── */}
        <div className="flex items-center bg-[#252540] rounded-md p-0.5 gap-0.5">
          <button onClick={() => handleSetTool('select')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              activeTool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Selection Mode (A)">
            <MousePointer2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Select</span>
          </button>
          <button onClick={() => handleSetTool('trim')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              activeTool === 'trim' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Trim Mode (T)">
            <Move className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Trim</span>
          </button>
          <button onClick={() => handleSetTool('razor')}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              activeTool === 'razor' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Razor Blade (B)">
            <Scissors className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Razor</span>
          </button>
        </div>

        <div className="w-px h-5 bg-[#333] mx-1.5" />

        {/* ── Snap toggle ── */}
        <button onClick={handleToggleSnap}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
            snapEnabled ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
          }`}
          title="Toggle Snapping (N)">
          <Magnet className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Snap</span>
        </button>

        <div className="w-px h-5 bg-[#333] mx-1.5" />

        {/* ── Transport controls ── */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => onPlayheadChange(0)}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Go to Start (Home)">
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button onClick={onTogglePlay}
            className={`p-1.5 rounded transition-colors ${isPlaying ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            title="Play/Pause (Space)">
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => onPlayheadChange(Math.max(0, totalDuration - 2))}
            className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Go to End (End)">
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="w-px h-5 bg-[#333] mx-1.5" />

        {/* ── Timecode display ── */}
        <div className="bg-[#0d0d1a] rounded px-2.5 py-1 font-mono text-sm text-blue-300 tabular-nums tracking-wider min-w-[90px] text-center">
          {formatTimelineTime(timeline.playheadPosition, zoom >= 120)}
        </div>
        <span className="text-[10px] text-gray-500 mx-1">/</span>
        <span className="font-mono text-[11px] text-gray-500 tabular-nums">
          {formatTimelineTime(totalDuration)}
        </span>

        <div className="flex-1" />

        {/* ── Clip actions ── */}
        {selectedClipId && (
          <>
            <button onClick={() => onClipSplit(selectedClipId, timeline.playheadPosition)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Split at Playhead (S)">
              <Scissors className="h-3.5 w-3.5" /> Split
            </button>
            <button onClick={() => onClipDelete(selectedClipId)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Delete Clip (Del)">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <div className="w-px h-5 bg-[#333] mx-1.5" />
          </>
        )}

        {/* ── Zoom controls ── */}
        <div className="flex items-center gap-1">
          <button onClick={handleZoomOut}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom Out (-)">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <div className="relative w-20 h-1.5 bg-[#333] rounded-full overflow-hidden group cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const newZoom = Math.exp(Math.log(MIN_ZOOM) + pct * (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM)));
              onTimelineChange({ ...timeline, zoom: newZoom });
            }}>
            <div className="absolute inset-y-0 left-0 bg-blue-500/60 rounded-full"
              style={{ width: `${zoomPercent}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-400 rounded-full shadow-lg"
              style={{ left: `calc(${zoomPercent}% - 5px)` }} />
          </div>
          <button onClick={handleZoomIn}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Zoom In (+)">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <span className="text-[10px] text-gray-500 ml-1 tabular-nums w-10 text-right">{Math.round(zoom)}px/s</span>
        </div>

        <div className="w-px h-5 bg-[#333] mx-1.5" />

        {/* ── Add track ── */}
        <div className="relative">
          <button onClick={() => setShowAddTrack(v => !v)}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Track
            <ChevronDown className="h-3 w-3" />
          </button>
          {showAddTrack && (
            <div className="absolute right-0 top-full mt-1 bg-[#252540] border border-[#444] rounded-lg shadow-2xl z-50 py-1 min-w-[140px]">
              {(['video', 'audio', 'text'] as TrackType[]).map(type => (
                <button key={type}
                  onClick={() => { onAddTrack(type); setShowAddTrack(false); }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/10 hover:text-white flex items-center gap-2 transition-colors">
                  <span className={`w-2 h-2 rounded-full ${
                    type === 'video' ? 'bg-blue-500' : type === 'audio' ? 'bg-green-500' : 'bg-purple-500'
                  }`} />
                  {type.charAt(0).toUpperCase() + type.slice(1)} Track
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════ TIMELINE AREA ══════════ */}
      <div className="flex flex-1 min-h-0">

        {/* ── Track headers (DaVinci Resolve style fixed left column) ── */}
        <div className="shrink-0 flex flex-col bg-[#1a1a2e] border-r border-[#333]"
          style={{ width: TRACK_HEADER_WIDTH }}>
          {/* Ruler spacer */}
          <div style={{ height: RULER_HEIGHT }} className="border-b border-[#333] bg-[#1e1e32]" />
          {/* Track headers */}
          {tracks.map(track => {
            const typeColor = track.type === 'video' ? 'blue' : track.type === 'audio' ? 'green' : 'purple';
            const isSelected = timeline.selectedTrackId === track.id;
            return (
              <div key={track.id}
                style={{ height: track.height + 8 }}
                className={`flex items-center gap-1 px-2 border-b border-[#222] transition-colors ${
                  isSelected ? 'bg-[#252540]' : 'hover:bg-[#1e1e30]'
                }`}>
                <GripVertical className="h-3 w-3 text-gray-600 shrink-0 cursor-grab" />

                {/* Track color indicator */}
                <div className={`w-1 self-stretch rounded-full bg-${typeColor}-500/60 shrink-0`} />

                {/* Track name */}
                <span className={`text-xs font-bold tracking-wide min-w-[20px] ${
                  track.type === 'video' ? 'text-blue-400' :
                    track.type === 'audio' ? 'text-green-400' : 'text-purple-400'
                }`}>{track.name}</span>

                <div className="flex-1" />

                {/* Track controls */}
                <div className="flex items-center gap-0.5">
                  <button onClick={() => handleToggleMute(track.id)}
                    className={`p-1 rounded transition-colors ${
                      track.muted ? 'text-red-400 bg-red-400/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                    title={track.muted ? 'Unmute' : 'Mute'}>
                    {track.type === 'audio'
                      ? (track.muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />)
                      : (track.muted ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />)}
                  </button>
                  <button onClick={() => handleToggleLock(track.id)}
                    className={`p-1 rounded transition-colors ${
                      track.locked ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                    title={track.locked ? 'Unlock' : 'Lock'}>
                    {track.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Scrollable timeline content ── */}
        <div ref={scrollRef}
          className={`flex-1 overflow-x-auto overflow-y-hidden relative ${trackCursor}`}
          onClick={handleTrackAreaClick}
          onMouseMove={handleTrackAreaMouseMove}
          onMouseLeave={handleTrackAreaMouseLeave}>

          <div style={{ width: timelineWidth, position: 'relative' }}>

            {/* ── Ruler (DaVinci Resolve style with tick marks) ── */}
            <div style={{ height: RULER_HEIGHT }}
              className="border-b border-[#444] bg-[#1e1e32] cursor-pointer sticky top-0 z-10"
              onPointerDown={handleRulerPointerDown}>
              {rulerTicks.map((tick, i) => {
                const x = timeToX(tick.time);
                return (
                  <div key={i} className="absolute top-0 bottom-0" style={{ left: x }}>
                    {/* Tick line */}
                    <div className={`absolute bottom-0 w-px ${
                      tick.type === 'major' ? 'h-3.5 bg-gray-400' :
                      tick.type === 'mid' ? 'h-2.5 bg-gray-500' :
                      'h-1.5 bg-gray-600'
                    }`} />
                    {/* Label (only major ticks) */}
                    {tick.type === 'major' && (
                      <span className="absolute top-1 text-[10px] text-gray-400 tabular-nums font-mono -translate-x-1/2 select-none whitespace-nowrap">
                        {formatTimelineTime(tick.time)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Tracks ── */}
            {tracks.map(track => {
              const colors = TRACK_COLORS[track.type];
              return (
                <div key={track.id}
                  style={{ height: track.height + 8 }}
                  className={`relative border-b border-[#222] ${colors.bg}`}>

                  {/* Clips */}
                  {track.clips.map(clip => {
                    const left = timeToX(clip.startTime);
                    const width = Math.max(timeToX(clip.duration), 6);
                    const isSelected = selectedClipId === clip.id;
                    const isDragging = dragState?.clipId === clip.id;

                    return (
                      <div key={clip.id} data-clip
                        className={`absolute top-1 rounded overflow-hidden transition-shadow ${
                          isSelected
                            ? `${colors.clipSelected} ring-2 ring-white/70 shadow-lg shadow-blue-500/20`
                            : `${colors.clip} hover:ring-1 hover:ring-white/40`
                        } ${isDragging ? 'opacity-90 shadow-xl scale-[1.01]' : ''}
                        ${track.locked ? 'opacity-40 pointer-events-none' : ''}
                        ${activeTool === 'razor' ? 'cursor-crosshair' : 'cursor-pointer'}`}
                        style={{ left, width, height: track.height }}
                        onPointerDown={(e) => handleClipPointerDown(e, clip, activeTool === 'razor' ? null : 'move')}>

                        {/* Resize handle left */}
                        {activeTool !== 'razor' && (
                          <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group"
                            onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, 'resize-left'); }}>
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/0 group-hover:bg-white/50 transition-colors" />
                          </div>
                        )}

                        {/* Clip content */}
                        <div className="px-2 py-1 h-full flex flex-col justify-center overflow-hidden pointer-events-none">
                          <span className="text-[11px] font-semibold text-white truncate leading-tight drop-shadow-sm">
                            {clip.text || clip.filename}
                          </span>
                          {width > 80 && (
                            <span className="text-[10px] text-white/60 tabular-nums truncate font-mono">
                              {formatTimelineTime(clip.startTime)} - {formatTimelineTime(clip.startTime + clip.duration)}
                            </span>
                          )}
                        </div>

                        {/* Waveform-style decoration for audio clips */}
                        {track.type === 'audio' && (
                          <div className="absolute inset-x-0 bottom-0 h-4 flex items-end gap-px px-1.5 pointer-events-none opacity-40">
                            {Array.from({ length: Math.min(Math.floor(width / 3), 60) }).map((_, i) => (
                              <div key={i} className="flex-1 bg-green-300 rounded-t-sm"
                                style={{ height: `${20 + Math.sin(i * 0.7) * 40 + Math.random() * 40}%` }} />
                            ))}
                          </div>
                        )}

                        {/* Resize handle right */}
                        {activeTool !== 'razor' && (
                          <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-10 group"
                            onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, 'resize-right'); }}>
                            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/0 group-hover:bg-white/50 transition-colors" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* ── Playhead (spans full height) ── */}
            <div className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{ left: playheadX }}>
              {/* Playhead marker triangle */}
              <div className="relative">
                <svg width="14" height="12" viewBox="0 0 14 12" className="absolute -left-[7px] top-0 drop-shadow-md">
                  <polygon points="0,0 14,0 7,10" fill="#ef4444" />
                </svg>
              </div>
              {/* Playhead line */}
              <div className="w-px h-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
            </div>

            {/* ── Razor hover line ── */}
            {razorHoverTime !== null && activeTool === 'razor' && (
              <div className="absolute top-0 bottom-0 z-25 pointer-events-none"
                style={{ left: timeToX(razorHoverTime) }}>
                <div className="w-px h-full bg-orange-400/70" style={{ borderLeft: '1px dashed rgba(251,146,60,0.7)' }} />
              </div>
            )}

            {/* ── Snap indicator ── */}
            {snapIndicator !== null && (
              <div className="absolute top-0 bottom-0 w-px bg-yellow-400/70 z-20 pointer-events-none"
                style={{ left: timeToX(snapIndicator) }} />
            )}
          </div>
        </div>
      </div>

      {/* ══════════ KEYBOARD SHORTCUTS BAR ══════════ */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-[#333] bg-[#1a1a2e] shrink-0">
        <div className="flex items-center gap-3 text-[10px] text-gray-500">
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">Space</kbd> Play</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">A</kbd> Select</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">B</kbd> Razor</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">T</kbd> Trim</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">S</kbd> Split</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">Del</kbd> Delete</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">J K L</kbd> Shuttle</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">&larr; &rarr;</kbd> Frame</span>
          <span><kbd className="px-1 py-0.5 bg-[#252540] rounded text-gray-400 text-[9px]">Ctrl+Scroll</kbd> Zoom</span>
        </div>
      </div>
    </div>
  );
}
