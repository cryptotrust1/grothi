'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Lock, Unlock, Volume2, VolumeX, Scissors, Plus,
  Trash2, ZoomIn, ZoomOut, Magnet, ChevronDown,
  Eye, EyeOff, MousePointer2, Move,
  Play, Pause,
} from 'lucide-react';
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [snapIndicator, setSnapIndicator] = useState<number | null>(null);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [razorHoverTime, setRazorHoverTime] = useState<number | null>(null);

  const { tracks, zoom, selectedClipId, snapEnabled, activeTool } = timeline;
  const totalDuration = timeline.totalDuration;
  const timelineWidth = Math.max(totalDuration * zoom, 600);

  // ── Ruler tick marks (DaVinci style) ─────────────────────────────────────
  const rulerTicks = useMemo(() => {
    const idealPx = 80;
    const rawInterval = idealPx / zoom;
    const niceIntervals = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    let majorInterval = niceIntervals[niceIntervals.length - 1];
    for (const ni of niceIntervals) {
      if (ni >= rawInterval) { majorInterval = ni; break; }
    }

    let subDivisions: number;
    if (majorInterval <= 1) subDivisions = 10;
    else if (majorInterval <= 2) subDivisions = 4;
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
    onPlayheadChange(getTimeFromPointer(e.clientX));
  }, [getTimeFromPointer, onPlayheadChange]);

  useEffect(() => {
    if (!scrubbing) return;
    const onMove = (e: PointerEvent) => onPlayheadChange(getTimeFromPointer(e.clientX));
    const onUp = () => setScrubbing(false);
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
  }, [scrubbing, getTimeFromPointer, onPlayheadChange]);

  // ── Clip dragging ───────────────────────────────────────────────────────
  const handleClipPointerDown = useCallback((e: React.PointerEvent, clip: TimelineClip, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();

    if (activeTool === 'razor') {
      onClipSplit(clip.id, getTimeFromPointer(e.clientX));
      return;
    }

    onClipSelect(clip.id);
    if (!mode) return;

    setDragState({
      mode, clipId: clip.id, trackId: clip.trackId, startX: e.clientX,
      originalStartTime: clip.startTime, originalDuration: clip.duration, originalMediaOffset: clip.mediaOffset,
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
        if (snapEnabled) {
          const snapPoints = [...getSnapPoints(newTimeline.tracks, clip.id), timeline.playheadPosition];
          const s1 = snapToPoint(newStart, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (s1.snapped) { newStart = s1.time; setSnapIndicator(newStart); }
          else {
            const s2 = snapToPoint(newStart + clip.duration, snapPoints, zoom, SNAP_THRESHOLD_PX);
            if (s2.snapped) { newStart = s2.time - clip.duration; setSnapIndicator(s2.time); }
            else setSnapIndicator(null);
          }
        }
        if (!wouldOverlap(track, newStart, clip.duration, clip.id)) clip.startTime = newStart;
      } else if (dragState.mode === 'resize-left') {
        let newStart = Math.max(0, dragState.originalStartTime + deltaTime);
        const originalEnd = dragState.originalStartTime + dragState.originalDuration;
        if (snapEnabled) {
          const snapPoints = [...getSnapPoints(newTimeline.tracks, clip.id), timeline.playheadPosition];
          const s = snapToPoint(newStart, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (s.snapped) { newStart = s.time; setSnapIndicator(newStart); } else setSnapIndicator(null);
        }
        const maxMediaTrim = dragState.originalMediaOffset + (dragState.originalStartTime - newStart);
        if (maxMediaTrim < 0) newStart = dragState.originalStartTime + dragState.originalMediaOffset;
        if (originalEnd - newStart < 0.1) newStart = originalEnd - 0.1;
        if (!wouldOverlap(track, newStart, originalEnd - newStart, clip.id)) {
          clip.startTime = newStart;
          clip.duration = originalEnd - newStart;
          clip.mediaOffset = dragState.originalMediaOffset + (newStart - dragState.originalStartTime);
        }
      } else if (dragState.mode === 'resize-right') {
        let newEnd = dragState.originalStartTime + dragState.originalDuration + deltaTime;
        if (snapEnabled) {
          const snapPoints = [...getSnapPoints(newTimeline.tracks, clip.id), timeline.playheadPosition];
          const s = snapToPoint(newEnd, snapPoints, zoom, SNAP_THRESHOLD_PX);
          if (s.snapped) { newEnd = s.time; setSnapIndicator(newEnd); } else setSnapIndicator(null);
        }
        let newDuration = newEnd - clip.startTime;
        const maxDuration = clip.mediaDuration - clip.mediaOffset;
        if (newDuration < 0.1) newDuration = 0.1;
        if (newDuration > maxDuration) newDuration = maxDuration;
        if (!wouldOverlap(track, clip.startTime, newDuration, clip.id)) clip.duration = newDuration;
      }

      track.clips[clipIdx] = clip;
      newTimeline.totalDuration = computeTotalDuration(newTimeline.tracks);
      onTimelineChange(newTimeline);
    };
    const onUp = () => { setDragState(null); setSnapIndicator(null); };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); };
  }, [dragState, zoom, timeline, snapEnabled, onTimelineChange]);

  // ── Zoom ────────────────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    onTimelineChange({ ...timeline, zoom: Math.min(MAX_ZOOM, zoom * 1.25) });
  }, [timeline, zoom, onTimelineChange]);

  const handleZoomOut = useCallback(() => {
    onTimelineChange({ ...timeline, zoom: Math.max(MIN_ZOOM, zoom / 1.25) });
  }, [timeline, zoom, onTimelineChange]);

  // Ctrl+Scroll zoom
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
        const newScrollLeft = timeAtMouse * newZoom - (e.clientX - rect.left);
        onTimelineChange({ ...timeline, zoom: newZoom, scrollLeft: Math.max(0, newScrollLeft) });
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
    onTimelineChange({ ...timeline, tracks: tracks.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t) });
  }, [timeline, tracks, onTimelineChange]);

  const handleToggleLock = useCallback((trackId: string) => {
    onTimelineChange({ ...timeline, tracks: tracks.map(t => t.id === trackId ? { ...t, locked: !t.locked } : t) });
  }, [timeline, tracks, onTimelineChange]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') { e.preventDefault(); onTogglePlay(); }
      if ((e.code === 'Delete' || e.code === 'Backspace') && selectedClipId) { e.preventDefault(); onClipDelete(selectedClipId); }
      if (e.code === 'KeyB') { e.preventDefault(); handleSetTool(activeTool === 'razor' ? 'select' : 'razor'); }
      if (e.code === 'KeyA' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); handleSetTool('select'); }
      if (e.code === 'KeyT' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); handleSetTool('trim'); }
      if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey && selectedClipId) { e.preventDefault(); onClipSplit(selectedClipId, timeline.playheadPosition); }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') { e.preventDefault(); handleZoomIn(); }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') { e.preventDefault(); handleZoomOut(); }
      if (e.code === 'KeyJ') { e.preventDefault(); onPlayheadChange(Math.max(0, timeline.playheadPosition - 1)); }
      if (e.code === 'KeyK') { e.preventDefault(); if (isPlaying) onTogglePlay(); }
      if (e.code === 'KeyL') { e.preventDefault(); onPlayheadChange(timeline.playheadPosition + 1); }
      if (e.code === 'ArrowLeft') { e.preventDefault(); onPlayheadChange(Math.max(0, timeline.playheadPosition - (e.shiftKey ? 1 : 1/30))); }
      if (e.code === 'ArrowRight') { e.preventDefault(); onPlayheadChange(timeline.playheadPosition + (e.shiftKey ? 1 : 1/30)); }
      if (e.code === 'Home') { e.preventDefault(); onPlayheadChange(0); }
      if (e.code === 'End') { e.preventDefault(); onPlayheadChange(totalDuration - 2); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, timeline.playheadPosition, isPlaying, activeTool, totalDuration,
      onTogglePlay, onClipDelete, onClipSplit, onPlayheadChange, handleZoomIn, handleZoomOut, handleSetTool]);

  // ── Auto-scroll to playhead ─────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const playheadX = timeToX(timeline.playheadPosition);
    const c = scrollRef.current;
    if (playheadX < c.scrollLeft + 50 || playheadX > c.scrollLeft + c.clientWidth - 50) {
      c.scrollLeft = Math.max(0, playheadX - c.clientWidth / 3);
    }
  }, [isPlaying, timeline.playheadPosition, timeToX]);

  // ── Razor hover / track click ────────────────────────────────────────────
  const handleTrackAreaMouseMove = useCallback((e: React.MouseEvent) => {
    setRazorHoverTime(activeTool === 'razor' ? getTimeFromPointer(e.clientX) : null);
  }, [activeTool, getTimeFromPointer]);

  const handleTrackAreaClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-clip]')) return;
    onClipSelect(null);
    onPlayheadChange(getTimeFromPointer(e.clientX));
  }, [onClipSelect, getTimeFromPointer, onPlayheadChange]);

  // ── Drop handler for media pool drag-and-drop ────────────────────────────
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData('application/json');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'media-to-timeline' && parsed.mediaId) {
        // Dispatch custom event that studio-editor will handle
        window.dispatchEvent(new CustomEvent('timeline-drop-media', {
          detail: { mediaId: parsed.mediaId, filename: parsed.filename, duration: parsed.duration },
        }));
      }
    } catch { /* invalid data */ }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // ── Computed ──────────────────────────────────────────────────────────────
  const playheadX = timeToX(timeline.playheadPosition);
  const zoomPct = Math.round(((Math.log(zoom) - Math.log(MIN_ZOOM)) / (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM))) * 100);
  const trackCursor = activeTool === 'razor' ? 'cursor-crosshair' : activeTool === 'trim' ? 'cursor-col-resize' : 'cursor-default';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col bg-[#1a1a2e] border-t border-[#333] select-none h-full">

      {/* ══ COMPACT TOOLBAR ══ */}
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-[#333] bg-[#1e1e32] shrink-0">
        {/* Tools */}
        <div className="flex items-center bg-[#252540] rounded p-0.5 gap-px">
          <button onClick={() => handleSetTool('select')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
              activeTool === 'select' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`} title="Select (A)">
            <MousePointer2 className="h-3 w-3" />
          </button>
          <button onClick={() => handleSetTool('trim')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
              activeTool === 'trim' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`} title="Trim (T)">
            <Move className="h-3 w-3" />
          </button>
          <button onClick={() => handleSetTool('razor')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
              activeTool === 'razor' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`} title="Blade (B)">
            <Scissors className="h-3 w-3" />
          </button>
        </div>

        <div className="w-px h-4 bg-[#333] mx-1" />

        <button onClick={handleToggleSnap}
          className={`px-1.5 py-0.5 rounded text-[11px] ${
            snapEnabled ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-gray-300'
          }`} title="Snap (N)">
          <Magnet className="h-3 w-3" />
        </button>

        <div className="w-px h-4 bg-[#333] mx-1" />

        {/* Transport */}
        <button onClick={onTogglePlay}
          className={`p-1 rounded ${isPlaying ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}>
          {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </button>

        {/* Timecode */}
        <div className="bg-[#0d0d1a] rounded px-2 py-0.5 font-mono text-xs text-blue-300 tabular-nums min-w-[70px] text-center ml-1">
          {formatTimelineTime(timeline.playheadPosition, zoom >= 150)}
        </div>
        <span className="text-[10px] text-gray-500 mx-0.5">/</span>
        <span className="font-mono text-[10px] text-gray-500 tabular-nums">{formatTimelineTime(totalDuration)}</span>

        <div className="flex-1" />

        {/* Clip actions */}
        {selectedClipId && (
          <>
            <button onClick={() => onClipSplit(selectedClipId, timeline.playheadPosition)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/10"
              title="Split (S)"><Scissors className="h-3 w-3" /> Split</button>
            <button onClick={() => onClipDelete(selectedClipId)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-gray-400 hover:text-red-400 hover:bg-red-400/10"
              title="Delete (Del)"><Trash2 className="h-3 w-3" /></button>
            <div className="w-px h-4 bg-[#333] mx-1" />
          </>
        )}

        {/* Zoom */}
        <button onClick={handleZoomOut} className="p-0.5 text-gray-400 hover:text-white" title="Zoom Out (-)">
          <ZoomOut className="h-3 w-3" />
        </button>
        <div className="relative w-14 h-1 bg-[#333] rounded-full overflow-hidden cursor-pointer mx-0.5"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onTimelineChange({ ...timeline, zoom: Math.exp(Math.log(MIN_ZOOM) + pct * (Math.log(MAX_ZOOM) - Math.log(MIN_ZOOM))) });
          }}>
          <div className="absolute inset-y-0 left-0 bg-blue-500/60 rounded-full" style={{ width: `${zoomPct}%` }} />
        </div>
        <button onClick={handleZoomIn} className="p-0.5 text-gray-400 hover:text-white" title="Zoom In (+)">
          <ZoomIn className="h-3 w-3" />
        </button>

        <div className="w-px h-4 bg-[#333] mx-1" />

        {/* Add track */}
        <div className="relative">
          <button onClick={() => setShowAddTrack(v => !v)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/10">
            <Plus className="h-3 w-3" /> <ChevronDown className="h-2.5 w-2.5" />
          </button>
          {showAddTrack && (
            <div className="absolute right-0 top-full mt-1 bg-[#252540] border border-[#444] rounded shadow-xl z-50 py-0.5 min-w-[120px]">
              {(['video', 'audio', 'text'] as TrackType[]).map(type => (
                <button key={type} onClick={() => { onAddTrack(type); setShowAddTrack(false); }}
                  className="w-full text-left px-3 py-1.5 text-[11px] text-gray-300 hover:bg-white/10 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    type === 'video' ? 'bg-blue-500' : type === 'audio' ? 'bg-green-500' : 'bg-purple-500'
                  }`} />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══ TIMELINE AREA ══ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Track headers ── */}
        <div className="shrink-0 flex flex-col bg-[#1a1a2e] border-r border-[#333]"
          style={{ width: TRACK_HEADER_WIDTH }}>
          <div style={{ height: RULER_HEIGHT }} className="border-b border-[#333] bg-[#1e1e32]" />
          {tracks.map(track => (
            <div key={track.id}
              style={{ height: track.height + 4 }}
              className={`flex items-center gap-1 px-1.5 border-b border-[#222] ${
                timeline.selectedTrackId === track.id ? 'bg-[#252540]' : ''
              }`}>
              <span className={`text-[11px] font-bold min-w-[18px] ${
                track.type === 'video' ? 'text-blue-400' : track.type === 'audio' ? 'text-green-400' : 'text-purple-400'
              }`}>{track.name}</span>
              <div className="flex-1" />
              <button onClick={() => handleToggleMute(track.id)}
                className={`p-0.5 rounded ${track.muted ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'}`}>
                {track.type === 'audio'
                  ? (track.muted ? <VolumeX className="h-2.5 w-2.5" /> : <Volume2 className="h-2.5 w-2.5" />)
                  : (track.muted ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />)}
              </button>
              <button onClick={() => handleToggleLock(track.id)}
                className={`p-0.5 rounded ${track.locked ? 'text-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}>
                {track.locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
              </button>
            </div>
          ))}
        </div>

        {/* ── Scrollable timeline content ── */}
        <div ref={scrollRef}
          className={`flex-1 overflow-x-auto overflow-y-auto relative ${trackCursor}`}
          onClick={handleTrackAreaClick}
          onMouseMove={handleTrackAreaMouseMove}
          onMouseLeave={() => setRazorHoverTime(null)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}>

          <div style={{ width: timelineWidth, position: 'relative' }}>

            {/* ── Ruler ── */}
            <div style={{ height: RULER_HEIGHT }}
              className="border-b border-[#444] bg-[#1e1e32] cursor-pointer sticky top-0 z-10"
              onPointerDown={handleRulerPointerDown}>
              {rulerTicks.map((tick, i) => (
                <div key={i} className="absolute top-0 bottom-0" style={{ left: timeToX(tick.time) }}>
                  <div className={`absolute bottom-0 w-px ${
                    tick.type === 'major' ? 'h-3 bg-gray-400' :
                    tick.type === 'mid' ? 'h-2 bg-gray-500' : 'h-1 bg-gray-600'
                  }`} />
                  {tick.type === 'major' && (
                    <span className="absolute top-0.5 text-[9px] text-gray-400 tabular-nums font-mono -translate-x-1/2 select-none whitespace-nowrap">
                      {formatTimelineTime(tick.time)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* ── Tracks with clips ── */}
            {tracks.map(track => {
              const colors = TRACK_COLORS[track.type];
              return (
                <div key={track.id}
                  style={{ height: track.height + 4 }}
                  className={`relative border-b border-[#222] ${colors.bg}`}>

                  {track.clips.map(clip => {
                    const left = timeToX(clip.startTime);
                    const width = Math.max(timeToX(clip.duration), 4);
                    const isSelected = selectedClipId === clip.id;
                    const isDragging = dragState?.clipId === clip.id;
                    // DaVinci Resolve trim handle colors: green = more footage, red = at boundary
                    const leftHasMore = clip.mediaOffset > 0.05;
                    const rightHasMore = clip.duration < (clip.mediaDuration - clip.mediaOffset - 0.05);

                    return (
                      <div key={clip.id} data-clip
                        className={`absolute top-0.5 rounded-sm overflow-hidden group ${
                          isSelected
                            ? `${colors.clipSelected} ring-1 ring-white/70 shadow-lg`
                            : `${colors.clip} hover:brightness-110`
                        } ${isDragging ? 'opacity-80 shadow-xl' : ''}
                        ${track.locked ? 'opacity-40 pointer-events-none' : ''}
                        ${activeTool === 'razor' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
                        style={{ left, width, height: track.height }}
                        onPointerDown={(e) => handleClipPointerDown(e, clip, activeTool === 'razor' ? null : 'move')}>

                        {/* ═══ LEFT TRIM HANDLE (DaVinci: green=more footage, red=at boundary) ═══ */}
                        {activeTool !== 'razor' && (
                          <div className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize z-10 group/trim"
                            onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, 'resize-left'); }}>
                            {/* Always-visible thin edge — green if extendable, red if at media start */}
                            <div className={`absolute left-0 top-0 bottom-0 w-[2px] transition-all rounded-l-sm ${
                              leftHasMore ? 'bg-green-400' : 'bg-red-500/60'
                            } group-hover/trim:w-[4px] group-hover/trim:bg-red-500`} />
                            {/* Arrow indicator on hover */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/trim:opacity-100 transition-opacity">
                              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                                <path d="M0 0 L0 14 L8 7 Z" fill="#ef4444" />
                              </svg>
                            </div>
                          </div>
                        )}

                        {/* Clip content */}
                        <div className="px-1.5 py-0.5 h-full flex flex-col justify-center overflow-hidden pointer-events-none mx-2">
                          {/* Filmstrip thumbnail bar for video clips */}
                          {track.type === 'video' && width > 30 && (
                            <div className="absolute inset-0 flex opacity-20 pointer-events-none">
                              {Array.from({ length: Math.min(Math.ceil(width / 40), 20) }).map((_, i) => (
                                <div key={i} className="flex-1 border-r border-white/10 bg-gradient-to-b from-blue-400/30 to-blue-600/10" />
                              ))}
                            </div>
                          )}
                          <span className="text-[10px] font-semibold text-white truncate leading-tight drop-shadow-sm relative z-[1]">
                            {clip.text || clip.filename}
                          </span>
                          {width > 60 && (
                            <span className="text-[9px] text-white/50 tabular-nums truncate font-mono relative z-[1]">
                              {formatTimelineTime(clip.duration)}
                            </span>
                          )}
                        </div>

                        {/* Waveform for audio clips */}
                        {track.type === 'audio' && (
                          <div className="absolute inset-x-0 bottom-0 h-3 flex items-end gap-px px-1 pointer-events-none opacity-30">
                            {Array.from({ length: Math.min(Math.floor(width / 3), 50) }).map((_, i) => (
                              <div key={i} className="flex-1 bg-green-300 rounded-t-sm"
                                style={{ height: `${20 + Math.sin(i * 0.7) * 40 + Math.random() * 40}%` }} />
                            ))}
                          </div>
                        )}

                        {/* ═══ RIGHT TRIM HANDLE (DaVinci: green=more footage, red=at boundary) ═══ */}
                        {activeTool !== 'razor' && (
                          <div className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize z-10 group/trim"
                            onPointerDown={(e) => { e.stopPropagation(); handleClipPointerDown(e, clip, 'resize-right'); }}>
                            {/* Always-visible thin edge — green if extendable, red if at media end */}
                            <div className={`absolute right-0 top-0 bottom-0 w-[2px] transition-all rounded-r-sm ${
                              rightHasMore ? 'bg-green-400' : 'bg-red-500/60'
                            } group-hover/trim:w-[4px] group-hover/trim:bg-red-500`} />
                            {/* Arrow indicator on hover */}
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/trim:opacity-100 transition-opacity">
                              <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                                <path d="M8 0 L8 14 L0 7 Z" fill="#ef4444" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* ── Playhead ── */}
            <div className="absolute top-0 bottom-0 z-30 pointer-events-none" style={{ left: playheadX }}>
              <svg width="12" height="10" viewBox="0 0 12 10" className="absolute -left-[6px] top-0 drop-shadow">
                <polygon points="0,0 12,0 6,9" fill="#ef4444" />
              </svg>
              <div className="w-px h-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.5)]" />
            </div>

            {/* ── Razor hover line ── */}
            {razorHoverTime !== null && activeTool === 'razor' && (
              <div className="absolute top-0 bottom-0 z-25 pointer-events-none"
                style={{ left: timeToX(razorHoverTime) }}>
                <div className="w-px h-full border-l border-dashed border-orange-400/70" />
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

      {/* ══ SHORTCUTS BAR (compact) ══ */}
      <div className="flex items-center gap-3 px-2 py-0.5 border-t border-[#333] bg-[#1a1a2e] shrink-0">
        <span className="text-[9px] text-gray-500">
          <kbd className="px-0.5 bg-[#252540] rounded text-gray-400">Space</kbd> Play
          &nbsp;&nbsp;<kbd className="px-0.5 bg-[#252540] rounded text-gray-400">A</kbd> Select
          &nbsp;&nbsp;<kbd className="px-0.5 bg-[#252540] rounded text-gray-400">T</kbd> Trim
          &nbsp;&nbsp;<kbd className="px-0.5 bg-[#252540] rounded text-gray-400">B</kbd> Blade
          &nbsp;&nbsp;<kbd className="px-0.5 bg-[#252540] rounded text-gray-400">S</kbd> Split
          &nbsp;&nbsp;<kbd className="px-0.5 bg-[#252540] rounded text-gray-400">Del</kbd> Delete
          &nbsp;&nbsp;<kbd className="px-0.5 bg-[#252540] rounded text-gray-400">J/K/L</kbd> Navigate
          &nbsp;&nbsp;<kbd className="px-0.5 bg-[#252540] rounded text-gray-400">Ctrl+Scroll</kbd> Zoom
          &nbsp;&nbsp;<span className="text-green-500/70">Green</span>=more footage <span className="text-red-500/70">Red</span>=at boundary
        </span>
      </div>
    </div>
  );
}
