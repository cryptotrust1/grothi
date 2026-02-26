'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Crop, Type, Pencil, Square, Download, RotateCcw, RotateCw,
  Loader2, ChevronRight, ChevronDown, ChevronUp, Image, Undo2, Redo2,
  FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Maximize,
  Palette, SlidersHorizontal, Frame, Layers,
  MousePointer, Sparkles, CheckCircle2, Trash2, Copy, Move,
  Circle, Triangle, Minus, ArrowRight, Star, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import Link from 'next/link';
import {
  type PhotoTool,
  type PhotoAdjustments,
  type PhotoFilterCategory,
  type TextOverlay,
  type DrawStroke,
  type ShapeOverlay,
  type FrameConfig,
  type CropState,
  type ExportFormat,
  PHOTO_FILTERS,
  PHOTO_FILTER_CATEGORY_LABELS,
  PHOTO_ADJUSTMENT_DEFS,
  CROP_PRESETS,
  FONT_FAMILIES,
  FONT_SIZES,
  COLOR_PALETTE,
  FRAME_PRESETS,
  SHAPE_TYPES,
  BRUSH_SIZES,
  EXPORT_FORMATS,
  createDefaultAdjustments,
  createDefaultTextOverlay,
  buildCompositeCSSFilter,
  hasActivePhotoAdjustments,
  genPhotoId,
  applyVignetteToImageData,
  applyGrainToImageData,
  renderTextOverlays,
  renderShapes,
  renderDrawStrokes,
  getFrameDimensions,
} from '@/lib/photo-editor-types';

// ── Helpers ──

interface ImageMedia {
  id: string;
  filename: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

interface PhotoEditorPanelProps {
  images: ImageMedia[];
  botId: string;
  botPageId: string;
}

// ── Undo/Redo state snapshot ──
interface EditorSnapshot {
  label: string;
  adjustments: PhotoAdjustments;
  selectedFilterId: string;
  textOverlays: TextOverlay[];
  drawStrokes: DrawStroke[];
  shapes: ShapeOverlay[];
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  crop: CropState | null;
  frame: FrameConfig | null;
}

export function PhotoEditorPanel({ images, botId, botPageId }: PhotoEditorPanelProps) {
  // ── Image selection ──
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  // ── Tool state ──
  const [activeTool, setActiveTool] = useState<PhotoTool>('select');

  // ── Filters ──
  const [selectedFilterId, setSelectedFilterId] = useState('original');
  const [filterCategory, setFilterCategory] = useState<PhotoFilterCategory | 'all'>('all');

  // ── Adjustments ──
  const [adjustments, setAdjustments] = useState<PhotoAdjustments>(createDefaultAdjustments);
  const [showAdjustments, setShowAdjustments] = useState(false);

  // ── Transform ──
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  // ── Crop ──
  const [crop, setCrop] = useState<CropState | null>(null);
  const [cropAspect, setCropAspect] = useState<string>('free');
  const [isCropping, setIsCropping] = useState(false);
  const [cropDrag, setCropDrag] = useState<{ type: string; startX: number; startY: number; startCrop: CropState } | null>(null);

  // ── Text overlays ──
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);

  // ── Drawing ──
  const [drawStrokes, setDrawStrokes] = useState<DrawStroke[]>([]);
  const [drawColor, setDrawColor] = useState('#FF0000');
  const [drawWidth, setDrawWidth] = useState(4);
  const [drawTool, setDrawTool] = useState<'pen' | 'marker' | 'eraser'>('pen');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  // ── Shapes ──
  const [shapes, setShapes] = useState<ShapeOverlay[]>([]);
  const [shapeType, setShapeType] = useState<ShapeOverlay['type']>('rectangle');
  const [shapeColor, setShapeColor] = useState('#FF0000');
  const [shapeFill, setShapeFill] = useState('transparent');

  // ── Frame ──
  const [frame, setFrame] = useState<FrameConfig | null>(null);

  // ── Export format ──
  const [exportFormat, setExportFormat] = useState<ExportFormat>(EXPORT_FORMATS[0]);
  const [exportQuality, setExportQuality] = useState(90);

  // ── Overlay dragging ──
  const [overlayDrag, setOverlayDrag] = useState<{
    id: string;
    type: 'text' | 'shape';
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // ── Undo/Redo ──
  const [undoStack, setUndoStack] = useState<EditorSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<EditorSnapshot[]>([]);

  // ── Processing ──
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ mediaId: string; url: string; filename: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Section collapse ──
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // ── Canvas refs ──
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);

  // ── Filter preview thumbnails ──
  const [filterThumbnails, setFilterThumbnails] = useState<Record<string, string>>({});

  // ── Selected image ──
  const selectedImage = useMemo(() => images.find(i => i.id === selectedImageId) ?? null, [images, selectedImageId]);

  // ── Current snapshot for undo ──
  const getCurrentSnapshot = useCallback((label: string): EditorSnapshot => ({
    label,
    adjustments: { ...adjustments },
    selectedFilterId,
    textOverlays: textOverlays.map(t => ({ ...t })),
    drawStrokes: drawStrokes.map(s => ({ ...s, points: [...s.points] })),
    shapes: shapes.map(s => ({ ...s })),
    rotation,
    flipH,
    flipV,
    crop: crop ? { ...crop } : null,
    frame: frame ? { ...frame } : null,
  }), [adjustments, selectedFilterId, textOverlays, drawStrokes, shapes, rotation, flipH, flipV, crop, frame]);

  const pushUndo = useCallback((label: string) => {
    const snapshot = getCurrentSnapshot(label);
    setUndoStack(prev => [...prev.slice(-49), snapshot]);
    setRedoStack([]);
  }, [getCurrentSnapshot]);

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const current = getCurrentSnapshot('redo point');
    setRedoStack(prev => [...prev, current]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setAdjustments(prev.adjustments);
    setSelectedFilterId(prev.selectedFilterId);
    setTextOverlays(prev.textOverlays);
    setDrawStrokes(prev.drawStrokes);
    setShapes(prev.shapes);
    setRotation(prev.rotation);
    setFlipH(prev.flipH);
    setFlipV(prev.flipV);
    setCrop(prev.crop);
    setFrame(prev.frame);
  }, [undoStack, getCurrentSnapshot]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const current = getCurrentSnapshot('undo point');
    setUndoStack(prev => [...prev, current]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setAdjustments(next.adjustments);
    setSelectedFilterId(next.selectedFilterId);
    setTextOverlays(next.textOverlays);
    setDrawStrokes(next.drawStrokes);
    setShapes(next.shapes);
    setRotation(next.rotation);
    setFlipH(next.flipH);
    setFlipV(next.flipV);
    setCrop(next.crop);
    setFrame(next.frame);
  }, [redoStack, getCurrentSnapshot]);

  // ── Image selection handler ──
  const handleImageSelect = useCallback((imageId: string) => {
    if (processing) return;
    setSelectedImageId(imageId);
    setImageLoading(true);
    setImageLoadError(null);
    setActiveTool('select');
    setSelectedFilterId('original');
    setFilterCategory('all');
    setAdjustments(createDefaultAdjustments());
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCrop(null);
    setIsCropping(false);
    setTextOverlays([]);
    setDrawStrokes([]);
    setShapes([]);
    setSelectedOverlayId(null);
    setFrame(null);
    setUndoStack([]);
    setRedoStack([]);
    setResult(null);
    setError(null);
    setShowAdjustments(false);
    setFilterThumbnails({});
  }, [processing]);

  // ── Load image ──
  useEffect(() => {
    if (!selectedImageId) return;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setNaturalWidth(img.naturalWidth);
      setNaturalHeight(img.naturalHeight);
      setImageLoading(false);
      // Generate filter thumbnails
      generateFilterThumbnails(img);
    };
    img.onerror = () => {
      setImageLoading(false);
      setImageLoadError('Failed to load image.');
    };
    img.src = `/api/media/${selectedImageId}`;
  }, [selectedImageId]);

  // ── Generate filter thumbnails ──
  const generateFilterThumbnails = useCallback((img: HTMLImageElement) => {
    const thumbs: Record<string, string> = {};
    const size = 64;
    for (const f of PHOTO_FILTERS) {
      if (f.id === 'original') continue;
      try {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        if (!ctx) continue;
        // Draw image cropped to center square
        const minDim = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - minDim) / 2;
        const sy = (img.naturalHeight - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        thumbs[f.id] = c.toDataURL('image/jpeg', 0.5);
      } catch {
        // Cross-origin or other error
      }
    }
    setFilterThumbnails(thumbs);
  }, []);

  // ── Composite CSS filter for preview ──
  const compositeCSSFilter = useMemo(
    () => buildCompositeCSSFilter(selectedFilterId, adjustments),
    [selectedFilterId, adjustments]
  );

  // ── Transform CSS ──
  const transformCSS = useMemo(() => {
    const parts: string[] = [];
    if (rotation !== 0) parts.push(`rotate(${rotation}deg)`);
    if (flipH) parts.push('scaleX(-1)');
    if (flipV) parts.push('scaleY(-1)');
    return parts.join(' ') || 'none';
  }, [rotation, flipH, flipV]);

  // ── Section toggle ──
  const toggleSection = useCallback((key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Tool-specific handlers ──

  // Crop
  const startCrop = useCallback(() => {
    pushUndo('Before crop');
    setActiveTool('crop');
    setIsCropping(true);
    if (!crop) {
      setCrop({ x: 10, y: 10, width: 80, height: 80, aspectRatio: cropAspect === 'free' ? null : cropAspect });
    }
  }, [crop, cropAspect, pushUndo]);

  const applyCrop = useCallback(() => {
    setIsCropping(false);
    setActiveTool('select');
  }, []);

  const cancelCrop = useCallback(() => {
    setCrop(null);
    setIsCropping(false);
    setActiveTool('select');
  }, []);

  // Rotate
  const handleRotateLeft = useCallback(() => {
    pushUndo('Rotate left');
    setRotation(r => (r - 90) % 360);
  }, [pushUndo]);

  const handleRotateRight = useCallback(() => {
    pushUndo('Rotate right');
    setRotation(r => (r + 90) % 360);
  }, [pushUndo]);

  const handleFlipH = useCallback(() => {
    pushUndo('Flip horizontal');
    setFlipH(v => !v);
  }, [pushUndo]);

  const handleFlipV = useCallback(() => {
    pushUndo('Flip vertical');
    setFlipV(v => !v);
  }, [pushUndo]);

  // Text
  const addText = useCallback(() => {
    pushUndo('Add text');
    const t = createDefaultTextOverlay(50, 50);
    setTextOverlays(prev => [...prev, t]);
    setSelectedOverlayId(t.id);
    setActiveTool('text');
  }, [pushUndo]);

  const updateTextOverlay = useCallback((id: string, updates: Partial<TextOverlay>) => {
    setTextOverlays(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const deleteSelectedOverlay = useCallback(() => {
    if (!selectedOverlayId) return;
    pushUndo('Delete overlay');
    setTextOverlays(prev => prev.filter(t => t.id !== selectedOverlayId));
    setShapes(prev => prev.filter(s => s.id !== selectedOverlayId));
    setSelectedOverlayId(null);
  }, [selectedOverlayId, pushUndo]);

  // Shape
  const addShape = useCallback(() => {
    pushUndo('Add shape');
    const s: ShapeOverlay = {
      id: genPhotoId('shape'),
      type: shapeType,
      x: 30,
      y: 30,
      width: 20,
      height: 20,
      color: shapeColor,
      fillColor: shapeFill,
      borderWidth: 2,
      rotation: 0,
      opacity: 1,
    };
    setShapes(prev => [...prev, s]);
    setSelectedOverlayId(s.id);
    setActiveTool('shape');
  }, [shapeType, shapeColor, shapeFill, pushUndo]);

  // Drawing
  const handleDrawStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== 'draw') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
    pushUndo('Draw stroke');
  }, [activeTool, pushUndo]);

  const handleDrawMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || activeTool !== 'draw') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setCurrentStroke(prev => [...prev, { x, y }]);
  }, [isDrawing, activeTool]);

  const handleDrawEnd = useCallback(() => {
    if (!isDrawing || currentStroke.length < 2) {
      setIsDrawing(false);
      setCurrentStroke([]);
      return;
    }
    const stroke: DrawStroke = {
      id: genPhotoId('stroke'),
      points: currentStroke,
      color: drawColor,
      width: drawWidth,
      opacity: 1,
      tool: drawTool,
    };
    setDrawStrokes(prev => [...prev, stroke]);
    setIsDrawing(false);
    setCurrentStroke([]);
  }, [isDrawing, currentStroke, drawColor, drawWidth, drawTool]);

  // Frame
  const handleFrameSelect = useCallback((f: FrameConfig) => {
    pushUndo('Change frame');
    setFrame(f.type === 'none' ? null : f);
  }, [pushUndo]);

  // Filter
  const handleFilterSelect = useCallback((filterId: string) => {
    pushUndo('Change filter');
    setSelectedFilterId(filterId);
  }, [pushUndo]);

  // Adjustment change (commit on blur/mouseup)
  const handleAdjustmentChange = useCallback((key: keyof PhotoAdjustments, value: number) => {
    setAdjustments(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAdjustmentCommit = useCallback(() => {
    pushUndo('Adjust');
  }, [pushUndo]);

  // Reset all
  const handleResetAll = useCallback(() => {
    pushUndo('Reset all');
    setAdjustments(createDefaultAdjustments());
    setSelectedFilterId('original');
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setCrop(null);
    setTextOverlays([]);
    setDrawStrokes([]);
    setShapes([]);
    setFrame(null);
    setSelectedOverlayId(null);
    setActiveTool('select');
  }, [pushUndo]);

  // ── Export / Process ──
  const handleExport = useCallback(async () => {
    if (!imgRef.current || !selectedImageId) return;
    setProcessing(true);
    setError(null);

    try {
      const img = imgRef.current;
      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Apply crop dimensions
      let cropX = 0, cropY = 0, cropW = w, cropH = h;
      if (crop) {
        cropX = Math.round((crop.x / 100) * w);
        cropY = Math.round((crop.y / 100) * h);
        cropW = Math.round((crop.width / 100) * w);
        cropH = Math.round((crop.height / 100) * h);
        w = cropW;
        h = cropH;
      }

      // Frame dimensions
      const frameDims = getFrameDimensions(frame, w, h);

      const canvas = document.createElement('canvas');
      canvas.width = frameDims.totalWidth;
      canvas.height = frameDims.totalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      // Draw frame background
      if (frame && frame.type !== 'none') {
        ctx.fillStyle = frame.color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        if (frame.type === 'polaroid') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }

      ctx.save();
      ctx.translate(frameDims.offsetX + w / 2, frameDims.offsetY + h / 2);

      // Apply rotation
      if (rotation !== 0) {
        ctx.rotate((rotation * Math.PI) / 180);
      }
      // Apply flip
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

      // Apply CSS filter equivalent via filter property (Chrome/Firefox)
      const filterStr = buildCompositeCSSFilter(selectedFilterId, adjustments);
      if (filterStr !== 'none') {
        ctx.filter = filterStr;
      }

      // Draw the image
      ctx.drawImage(img, cropX, cropY, cropW, cropH, -w / 2, -h / 2, w, h);
      ctx.restore();

      // Apply vignette/grain via pixel manipulation (these need ImageData)
      if (adjustments.vignette > 0 || adjustments.grain > 0) {
        const imageData = ctx.getImageData(frameDims.offsetX, frameDims.offsetY, w, h);
        applyVignetteToImageData(imageData, adjustments.vignette);
        applyGrainToImageData(imageData, adjustments.grain);
        ctx.putImageData(imageData, frameDims.offsetX, frameDims.offsetY);
      }

      // Draw overlays
      ctx.save();
      ctx.translate(frameDims.offsetX, frameDims.offsetY);
      renderDrawStrokes(ctx, drawStrokes, w, h);
      renderShapes(ctx, shapes, w, h);
      renderTextOverlays(ctx, textOverlays, w, h);
      ctx.restore();

      // Apply rounded corners if frame requires
      if (frame && frame.type === 'rounded' && frame.radius > 0) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.beginPath();
          const r = frame.radius;
          tempCtx.moveTo(r, 0);
          tempCtx.arcTo(canvas.width, 0, canvas.width, canvas.height, r);
          tempCtx.arcTo(canvas.width, canvas.height, 0, canvas.height, r);
          tempCtx.arcTo(0, canvas.height, 0, 0, r);
          tempCtx.arcTo(0, 0, canvas.width, 0, r);
          tempCtx.closePath();
          tempCtx.clip();
          tempCtx.drawImage(canvas, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tempCanvas, 0, 0);
        }
      }

      // Export as blob in selected format
      const quality = exportFormat.supportsQuality ? exportQuality / 100 : 1.0;
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to export image'))),
          exportFormat.mime,
          quality
        );
      });

      // Upload to server
      const formData = new FormData();
      formData.append('file', blob, `edited-${Date.now()}.${exportFormat.ext}`);
      formData.append('botId', botId);

      const res = await fetch('/api/media', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload failed (${res.status})`);
      }

      const data = await res.json();
      setResult({
        mediaId: data.id,
        url: `/api/media/${data.id}`,
        filename: data.filename || `edited-${Date.now()}.${exportFormat.ext}`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setProcessing(false);
    }
  }, [selectedImageId, crop, frame, rotation, flipH, flipV, selectedFilterId, adjustments, drawStrokes, shapes, textOverlays, botId, exportFormat, exportQuality]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedOverlayId && activeTool !== 'text') {
          e.preventDefault();
          deleteSelectedOverlay();
        }
      }
      if (e.key === 'Escape') {
        setSelectedOverlayId(null);
        if (isCropping) cancelCrop();
        setActiveTool('select');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, selectedOverlayId, activeTool, isCropping, cancelCrop, deleteSelectedOverlay]);

  // ── Edit summary for status bar ──
  const editSummary = useMemo(() => {
    const parts: string[] = [];
    if (selectedFilterId !== 'original') {
      const f = PHOTO_FILTERS.find(f => f.id === selectedFilterId);
      parts.push(f?.name ?? selectedFilterId);
    }
    if (hasActivePhotoAdjustments(adjustments)) parts.push('Adjusted');
    if (rotation !== 0) parts.push(`${rotation}°`);
    if (flipH) parts.push('Flip H');
    if (flipV) parts.push('Flip V');
    if (crop) parts.push('Cropped');
    if (textOverlays.length > 0) parts.push(`${textOverlays.length} text`);
    if (drawStrokes.length > 0) parts.push(`${drawStrokes.length} strokes`);
    if (shapes.length > 0) parts.push(`${shapes.length} shapes`);
    if (frame) parts.push(frame.name);
    return parts;
  }, [selectedFilterId, adjustments, rotation, flipH, flipV, crop, textOverlays, drawStrokes, shapes, frame]);

  // ── Section header helper ──
  const SectionHeader = ({ id, icon: Icon, label }: { id: string; icon: React.ElementType; label: string }) => (
    <button onClick={() => toggleSection(id)} className="flex items-center justify-between w-full px-3 py-2 bg-muted/40 border-b text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60 transition-colors">
      <span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" /> {label}</span>
      {collapsedSections[id] ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
    </button>
  );

  // ── Filtered filter list ──
  const filteredFilters = useMemo(() => {
    if (filterCategory === 'all') return PHOTO_FILTERS;
    return PHOTO_FILTERS.filter(f => f.category === filterCategory);
  }, [filterCategory]);

  // ── Selected text overlay ──
  const selectedText = useMemo(
    () => textOverlays.find(t => t.id === selectedOverlayId) ?? null,
    [textOverlays, selectedOverlayId]
  );

  // ── Crop drag handlers ──
  const handleCropPointerDown = useCallback((e: React.PointerEvent, type: string) => {
    if (!crop) return;
    e.stopPropagation();
    e.preventDefault();
    setCropDrag({ type, startX: e.clientX, startY: e.clientY, startCrop: { ...crop } });
  }, [crop]);

  useEffect(() => {
    if (!cropDrag) return;
    const handleMove = (e: PointerEvent) => {
      if (!cropDrag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - cropDrag.startX) / rect.width) * 100;
      const dy = ((e.clientY - cropDrag.startY) / rect.height) * 100;
      const sc = cropDrag.startCrop;

      if (cropDrag.type === 'move') {
        const newX = Math.max(0, Math.min(100 - sc.width, sc.x + dx));
        const newY = Math.max(0, Math.min(100 - sc.height, sc.y + dy));
        setCrop({ ...sc, x: newX, y: newY });
      } else if (cropDrag.type === 'se') {
        const newW = Math.max(5, Math.min(100 - sc.x, sc.width + dx));
        const newH = Math.max(5, Math.min(100 - sc.y, sc.height + dy));
        setCrop({ ...sc, width: newW, height: newH });
      } else if (cropDrag.type === 'nw') {
        const newX = Math.max(0, sc.x + dx);
        const newY = Math.max(0, sc.y + dy);
        const newW = Math.max(5, sc.width - dx);
        const newH = Math.max(5, sc.height - dy);
        setCrop({ ...sc, x: newX, y: newY, width: newW, height: newH });
      } else if (cropDrag.type === 'ne') {
        const newW = Math.max(5, Math.min(100 - sc.x, sc.width + dx));
        const newY = Math.max(0, sc.y + dy);
        const newH = Math.max(5, sc.height - dy);
        setCrop({ ...sc, y: newY, width: newW, height: newH });
      } else if (cropDrag.type === 'sw') {
        const newX = Math.max(0, sc.x + dx);
        const newW = Math.max(5, sc.width - dx);
        const newH = Math.max(5, Math.min(100 - sc.y, sc.height + dy));
        setCrop({ ...sc, x: newX, width: newW, height: newH });
      }
    };
    const handleUp = () => setCropDrag(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [cropDrag]);

  // ── Overlay drag handlers ──
  const handleOverlayDragStart = useCallback((e: React.PointerEvent, id: string, type: 'text' | 'shape', posX: number, posY: number) => {
    if (activeTool === 'draw' || isCropping) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedOverlayId(id);
    setActiveTool(type);
    setOverlayDrag({ id, type, startX: e.clientX, startY: e.clientY, startPosX: posX, startPosY: posY });
  }, [activeTool, isCropping]);

  useEffect(() => {
    if (!overlayDrag) return;
    let moved = false;
    const handleMove = (e: PointerEvent) => {
      if (!overlayDrag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ((e.clientX - overlayDrag.startX) / rect.width) * 100;
      const dy = ((e.clientY - overlayDrag.startY) / rect.height) * 100;
      if (!moved && (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5)) {
        moved = true;
        pushUndo('Move overlay');
      }
      const newX = Math.max(0, Math.min(100, overlayDrag.startPosX + dx));
      const newY = Math.max(0, Math.min(100, overlayDrag.startPosY + dy));
      if (overlayDrag.type === 'text') {
        setTextOverlays(prev => prev.map(t => t.id === overlayDrag.id ? { ...t, x: newX, y: newY } : t));
      } else {
        setShapes(prev => prev.map(s => s.id === overlayDrag.id ? { ...s, x: newX, y: newY } : s));
      }
    };
    const handleUp = () => setOverlayDrag(null);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [overlayDrag, pushUndo]);

  // ═══════════ RENDER ═══════════

  if (images.length === 0) {
    return (
      <div className="text-center py-16">
        <Image className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-lg font-medium">No images yet</p>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Upload an image in your{' '}
          <Link href={`/dashboard/bots/${botPageId}/media`} className="text-primary underline">Media library</Link>
          {' '}to start editing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '100%', minHeight: 0 }}>
      {/* ══════════════ TOOLBAR ══════════════ */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border rounded-t-lg bg-muted/30 flex-shrink-0 flex-wrap">
        {/* Tool buttons */}
        {([
          { tool: 'select' as const, icon: MousePointer, label: 'Select' },
          { tool: 'crop' as const, icon: Crop, label: 'Crop' },
          { tool: 'text' as const, icon: Type, label: 'Text' },
          { tool: 'draw' as const, icon: Pencil, label: 'Draw' },
          { tool: 'shape' as const, icon: Square, label: 'Shape' },
          { tool: 'frame' as const, icon: Frame, label: 'Frame' },
        ] as const).map(({ tool, icon: Icon, label }) => (
          <button
            key={tool}
            onClick={() => {
              if (activeTool === tool) return;
              setActiveTool(tool);
              setSelectedOverlayId(null);
              if (tool === 'crop') startCrop();
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              activeTool === tool
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title={label}
          >
            <Icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{label}</span>
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Transform buttons */}
        <button onClick={handleRotateLeft} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Rotate Left">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleRotateRight} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Rotate Right">
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleFlipH} className={`p-1 rounded hover:bg-muted ${flipH ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Flip Horizontal">
          <FlipHorizontal className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleFlipV} className={`p-1 rounded hover:bg-muted ${flipV ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} title="Flip Vertical">
          <FlipVertical className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Undo/Redo */}
        <button onClick={handleUndo} disabled={undoStack.length === 0} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30" title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={handleRedo} disabled={redoStack.length === 0} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-3.5 w-3.5" />
        </button>

        <div className="h-4 w-px bg-border mx-1" />

        <button onClick={handleResetAll} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Reset All">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>

        {/* Spacer + Export */}
        <div className="flex-1" />

        {error && (
          <span className="text-[10px] text-destructive max-w-[200px] truncate" title={error}>{error}</span>
        )}
        {result ? (
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 gap-1">
              <CheckCircle2 className="h-2.5 w-2.5" /> Saved to Media
            </Badge>
            <a href={`${result.url}?download=true`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7"><Download className="h-3 w-3" /> Download</Button>
            </a>
            <Link href={`/dashboard/bots/${botPageId}/post?mediaId=${result.mediaId}`}>
              <Button size="sm" className="gap-1.5 text-xs h-7"><ChevronRight className="h-3 w-3" /> Use in Post</Button>
            </Link>
            <Link href={`/dashboard/bots/${botPageId}/media`}>
              <Button variant="outline" size="sm" className="text-xs h-7">Media Library</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => setResult(null)} className="text-xs h-7">
              <RotateCcw className="h-3 w-3 mr-1" /> Edit more
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <select
              value={exportFormat.value}
              onChange={(e) => {
                const fmt = EXPORT_FORMATS.find(f => f.value === e.target.value);
                if (fmt) setExportFormat(fmt);
              }}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-[10px]"
            >
              {EXPORT_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <Button onClick={handleExport} disabled={processing || !selectedImageId} size="sm" className="gap-1.5 text-xs h-7">
              {processing ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</> : <><Sparkles className="h-3 w-3" /> Export &amp; Save</>}
            </Button>
          </div>
        )}
      </div>

      {/* ══════════════ MAIN LAYOUT ══════════════ */}
      <div className="flex flex-1 gap-0" style={{ minHeight: 0 }}>

        {/* ── LEFT: Image Pool ── */}
        <div className="w-44 lg:w-52 shrink-0 flex flex-col border-l border-b rounded-bl-lg bg-card" style={{ overflow: 'hidden' }}>
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Images
            </span>
            <span className="text-[10px] text-muted-foreground">{images.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {images.map((img) => {
              const isSelected = selectedImageId === img.id;
              return (
                <button
                  key={img.id}
                  onClick={() => handleImageSelect(img.id)}
                  disabled={processing}
                  className={`w-full rounded-md border overflow-hidden transition-all ${
                    isSelected ? 'border-primary ring-1 ring-primary/30 shadow-sm' : 'border-muted hover:border-primary/40'
                  } ${processing ? 'opacity-50' : ''}`}
                >
                  <div className="aspect-square bg-muted relative flex items-center justify-center overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/media/${img.id}`}
                      alt={img.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-primary drop-shadow-md" />
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1 bg-muted/40">
                    <p className="text-[10px] font-medium truncate text-left">{img.filename}</p>
                    <p className="text-[9px] text-muted-foreground text-left">
                      {formatFileSize(img.fileSize)}
                      {img.width && img.height && ` · ${img.width}×${img.height}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CENTER: Preview Canvas ── */}
        <div className="flex-1 flex items-center justify-center bg-muted/20 border-b border-x overflow-hidden relative">
          {!selectedImageId ? (
            <div className="text-center">
              <Image className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Select an image to start editing</p>
            </div>
          ) : imageLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading image...
            </div>
          ) : imageLoadError ? (
            <div className="text-center">
              <p className="text-sm text-destructive">{imageLoadError}</p>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative inline-block"
              style={{ touchAction: 'none', userSelect: 'none' }}
              onPointerDown={handleDrawStart}
              onPointerMove={handleDrawMove}
              onPointerUp={handleDrawEnd}
            >
              {/* Main image with CSS filter preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgElRef}
                src={`/api/media/${selectedImageId}`}
                alt="Editor preview"
                className="block max-w-full max-h-[calc(100vh-16rem)]"
                style={{
                  filter: compositeCSSFilter,
                  transform: transformCSS,
                  borderRadius: frame?.type === 'rounded' ? `${frame.radius}px` : undefined,
                  border: frame && (frame.type === 'border' || frame.type === 'vintage')
                    ? `${frame.width}px solid ${frame.color}`
                    : undefined,
                  boxShadow: frame?.type === 'shadow' ? '0 8px 32px rgba(0,0,0,0.3)' : undefined,
                  padding: frame?.type === 'polaroid'
                    ? `${frame.width}px ${frame.width}px ${frame.width * 3}px ${frame.width}px`
                    : undefined,
                  backgroundColor: frame?.type === 'polaroid' ? '#FFFFFF' : undefined,
                }}
                draggable={false}
              />

              {/* Crop overlay */}
              {isCropping && crop && (
                <>
                  {/* Dark overlay outside crop */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute bg-black/50" style={{ top: 0, left: 0, right: 0, height: `${crop.y}%` }} />
                    <div className="absolute bg-black/50" style={{ bottom: 0, left: 0, right: 0, height: `${100 - crop.y - crop.height}%` }} />
                    <div className="absolute bg-black/50" style={{ top: `${crop.y}%`, left: 0, width: `${crop.x}%`, height: `${crop.height}%` }} />
                    <div className="absolute bg-black/50" style={{ top: `${crop.y}%`, right: 0, width: `${100 - crop.x - crop.width}%`, height: `${crop.height}%` }} />
                  </div>
                  {/* Crop rectangle */}
                  <div
                    className="absolute border-2 border-white cursor-move"
                    style={{
                      top: `${crop.y}%`, left: `${crop.x}%`,
                      width: `${crop.width}%`, height: `${crop.height}%`,
                      touchAction: 'none',
                    }}
                    onPointerDown={(e) => handleCropPointerDown(e, 'move')}
                  >
                    {/* Rule of thirds grid */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                      <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                      <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                      <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                    </div>
                    {/* Resize handles */}
                    {['nw', 'ne', 'sw', 'se'].map(corner => (
                      <div
                        key={corner}
                        className="absolute w-4 h-4 bg-white border border-gray-400 rounded-sm"
                        style={{
                          top: corner.startsWith('n') ? -8 : undefined,
                          bottom: corner.startsWith('s') ? -8 : undefined,
                          left: corner.endsWith('w') ? -8 : undefined,
                          right: corner.endsWith('e') ? -8 : undefined,
                          cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
                          touchAction: 'none',
                        }}
                        onPointerDown={(e) => handleCropPointerDown(e, corner)}
                      />
                    ))}
                  </div>
                  {/* Crop action buttons */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    <Button size="sm" onClick={applyCrop} className="text-xs h-7 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Apply
                    </Button>
                    <Button variant="outline" size="sm" onClick={cancelCrop} className="text-xs h-7">Cancel</Button>
                  </div>
                </>
              )}

              {/* Text overlay previews */}
              {textOverlays.map(t => (
                <div
                  key={t.id}
                  className={`absolute cursor-move select-none ${
                    selectedOverlayId === t.id ? 'ring-2 ring-primary ring-offset-1' : 'hover:ring-1 hover:ring-primary/40'
                  }`}
                  style={{
                    left: `${t.x}%`, top: `${t.y}%`,
                    transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                    fontSize: `${Math.max(10, t.fontSize * 0.5)}px`,
                    fontFamily: t.fontFamily,
                    color: t.color,
                    backgroundColor: t.backgroundColor !== 'transparent' ? t.backgroundColor : undefined,
                    fontWeight: t.bold ? 'bold' : 'normal',
                    fontStyle: t.italic ? 'italic' : 'normal',
                    textDecoration: t.underline ? 'underline' : 'none',
                    textAlign: t.textAlign,
                    opacity: t.opacity,
                    textShadow: t.shadow ? '1px 1px 3px rgba(0,0,0,0.5)' : undefined,
                    WebkitTextStroke: t.outline ? '1px #000' : undefined,
                    padding: '4px 8px',
                    whiteSpace: 'nowrap',
                    touchAction: 'none',
                    pointerEvents: activeTool === 'draw' ? 'none' : 'auto',
                    zIndex: selectedOverlayId === t.id ? 20 : 10,
                  }}
                  onPointerDown={(e) => handleOverlayDragStart(e, t.id, 'text', t.x, t.y)}
                >
                  {t.text}
                </div>
              ))}

              {/* Shape overlay previews */}
              {shapes.map(s => (
                <div
                  key={s.id}
                  className={`absolute cursor-move select-none ${
                    selectedOverlayId === s.id ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/40'
                  }`}
                  style={{
                    left: `${s.x}%`, top: `${s.y}%`,
                    width: `${s.width}%`, height: `${s.height}%`,
                    transform: `rotate(${s.rotation}deg)`,
                    opacity: s.opacity,
                    touchAction: 'none',
                    pointerEvents: activeTool === 'draw' ? 'none' : 'auto',
                    zIndex: selectedOverlayId === s.id ? 20 : 10,
                  }}
                  onPointerDown={(e) => handleOverlayDragStart(e, s.id, 'shape', s.x, s.y)}
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
                    {s.type === 'rectangle' && (
                      <rect x="2" y="2" width="96" height="96" fill={s.fillColor} stroke={s.color} strokeWidth={s.borderWidth * 2} />
                    )}
                    {s.type === 'circle' && (
                      <ellipse cx="50" cy="50" rx="48" ry="48" fill={s.fillColor} stroke={s.color} strokeWidth={s.borderWidth * 2} />
                    )}
                    {s.type === 'triangle' && (
                      <polygon points="50,2 98,98 2,98" fill={s.fillColor} stroke={s.color} strokeWidth={s.borderWidth * 2} />
                    )}
                    {s.type === 'line' && (
                      <line x1="2" y1="50" x2="98" y2="50" stroke={s.color} strokeWidth={s.borderWidth * 2} />
                    )}
                    {s.type === 'arrow' && (
                      <>
                        <line x1="2" y1="50" x2="88" y2="50" stroke={s.color} strokeWidth={s.borderWidth * 2} />
                        <polygon points="98,50 80,38 80,62" fill={s.color} />
                      </>
                    )}
                    {s.type === 'star' && (
                      <polygon
                        points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38"
                        fill={s.fillColor} stroke={s.color} strokeWidth={s.borderWidth * 2}
                      />
                    )}
                  </svg>
                </div>
              ))}

              {/* Drawing strokes SVG overlay */}
              {(drawStrokes.length > 0 || (isDrawing && currentStroke.length > 1)) && (
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
                  {drawStrokes.map(s => (
                    <polyline
                      key={s.id}
                      points={s.points.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={s.tool === 'eraser' ? '#FFFFFF' : s.color}
                      strokeWidth={s.width * 0.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={s.tool === 'marker' ? 0.5 : s.opacity}
                    />
                  ))}
                  {isDrawing && currentStroke.length > 1 && (
                    <polyline
                      points={currentStroke.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={drawTool === 'eraser' ? '#FFFFFF' : drawColor}
                      strokeWidth={drawWidth * 0.3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={drawTool === 'marker' ? 0.5 : 1}
                    />
                  )}
                </svg>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Tools Panel ── */}
        <div className="w-56 lg:w-64 shrink-0 flex flex-col border-r border-b rounded-br-lg bg-card overflow-y-auto">

          {/* ── Filters Section ── */}
          <SectionHeader id="filters" icon={Palette} label="Filters" />
          {!collapsedSections['filters'] && (
            <div className="p-2 border-b">
              {/* Category tabs */}
              <div className="flex flex-wrap gap-1 mb-2">
                <button onClick={() => setFilterCategory('all')}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${filterCategory === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  All
                </button>
                {(Object.keys(PHOTO_FILTER_CATEGORY_LABELS) as PhotoFilterCategory[]).filter(c => c !== 'original').map(cat => (
                  <button key={cat} onClick={() => setFilterCategory(cat)}
                    className={`text-[10px] px-1.5 py-0.5 rounded ${filterCategory === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {PHOTO_FILTER_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
              {/* Filter grid */}
              <div className="grid grid-cols-4 gap-1">
                {filteredFilters.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFilterSelect(f.id)}
                    className={`rounded overflow-hidden border text-center transition-all ${
                      selectedFilterId === f.id ? 'border-primary ring-1 ring-primary/30' : 'border-muted hover:border-primary/30'
                    }`}
                    title={f.name}
                  >
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {filterThumbnails[f.id] ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={filterThumbnails[f.id]} alt={f.name} className="w-full h-full object-cover" style={{ filter: f.cssFilter || 'none' }} />
                      ) : selectedImageId ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={`/api/media/${selectedImageId}`} alt={f.name} className="w-full h-full object-cover" style={{ filter: f.cssFilter || 'none' }} loading="lazy" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" style={{ filter: f.cssFilter || 'none' }} />
                      )}
                    </div>
                    <p className="text-[9px] py-0.5 truncate px-0.5">{f.name}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Adjustments Section ── */}
          <SectionHeader id="adjustments" icon={SlidersHorizontal} label="Adjustments" />
          {!collapsedSections['adjustments'] && (
            <div className="p-2 space-y-2 border-b">
              {PHOTO_ADJUSTMENT_DEFS.map(def => (
                <div key={def.key} className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">{def.label}</Label>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{adjustments[def.key]}</span>
                  </div>
                  <input
                    type="range"
                    min={def.min}
                    max={def.max}
                    step={def.step}
                    value={adjustments[def.key]}
                    onChange={(e) => handleAdjustmentChange(def.key, Number(e.target.value))}
                    onMouseUp={handleAdjustmentCommit}
                    onTouchEnd={handleAdjustmentCommit}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full text-[10px] h-6" onClick={() => {
                pushUndo('Reset adjustments');
                setAdjustments(createDefaultAdjustments());
              }}>
                <RotateCcw className="h-2.5 w-2.5 mr-1" /> Reset Adjustments
              </Button>
            </div>
          )}

          {/* ── Crop Presets ── */}
          {isCropping && (
            <>
              <SectionHeader id="crop-presets" icon={Crop} label="Crop Presets" />
              {!collapsedSections['crop-presets'] && (
                <div className="p-2 border-b">
                  <div className="grid grid-cols-3 gap-1">
                    {CROP_PRESETS.slice(0, 12).map(p => (
                      <button
                        key={p.value}
                        onClick={() => {
                          setCropAspect(p.value);
                          if (p.value === 'free') {
                            setCrop(c => c ? { ...c, aspectRatio: null } : null);
                          } else if (p.width > 0 && p.height > 0) {
                            const ar = p.width / p.height;
                            const w = 80;
                            const h = w / ar;
                            setCrop({ x: 10, y: 10, width: w, height: Math.min(80, h), aspectRatio: p.value });
                          }
                        }}
                        className={`text-[10px] px-1.5 py-1 rounded border text-center ${
                          cropAspect === p.value ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-primary/40'
                        }`}
                      >
                        <div className="font-medium">{p.label}</div>
                        <div className="text-[8px] text-muted-foreground">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                  {/* Social media sizes */}
                  <p className="text-[10px] font-medium mt-2 mb-1 text-muted-foreground">Social Media</p>
                  <div className="grid grid-cols-3 gap-1">
                    {CROP_PRESETS.slice(12).map(p => (
                      <button
                        key={p.value}
                        onClick={() => {
                          setCropAspect(p.value);
                          const ar = p.width / p.height;
                          const w = 80;
                          const h = w / ar;
                          setCrop({ x: 10, y: 10, width: w, height: Math.min(80, h), aspectRatio: p.value });
                        }}
                        className={`text-[10px] px-1 py-1 rounded border text-center ${
                          cropAspect === p.value ? 'border-primary bg-primary/10 text-primary' : 'border-muted hover:border-primary/40'
                        }`}
                      >
                        <div className="font-medium truncate">{p.label}</div>
                        <div className="text-[8px] text-muted-foreground">{p.width}×{p.height}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Text Properties ── */}
          {activeTool === 'text' && (
            <>
              <SectionHeader id="text-props" icon={Type} label="Text" />
              {!collapsedSections['text-props'] && (
                <div className="p-2 space-y-2 border-b">
                  <Button size="sm" className="w-full text-[10px] h-6 gap-1" onClick={addText}>
                    <Type className="h-2.5 w-2.5" /> Add New Text
                  </Button>
                  {textOverlays.length > 0 && !selectedText && (
                    <p className="text-[10px] text-muted-foreground text-center">Click a text overlay to select it</p>
                  )}
                  {selectedText && (
                  <>
                  <div>
                    <Label className="text-[10px]">Content</Label>
                    <Input
                      value={selectedText.text}
                      onChange={(e) => updateTextOverlay(selectedText.id, { text: e.target.value })}
                      className="h-7 text-[11px]"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="flex-1">
                      <Label className="text-[10px]">Font</Label>
                      <select
                        value={selectedText.fontFamily}
                        onChange={(e) => updateTextOverlay(selectedText.id, { fontFamily: e.target.value })}
                        className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-[10px]"
                      >
                        {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                      </select>
                    </div>
                    <div className="w-16">
                      <Label className="text-[10px]">Size</Label>
                      <select
                        value={selectedText.fontSize}
                        onChange={(e) => updateTextOverlay(selectedText.id, { fontSize: Number(e.target.value) })}
                        className="flex h-7 w-full rounded-md border border-input bg-background px-2 text-[10px]"
                      >
                        {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Color</Label>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {COLOR_PALETTE.slice(0, 12).map(c => (
                        <button
                          key={c}
                          onClick={() => updateTextOverlay(selectedText.id, { color: c })}
                          className={`w-5 h-5 rounded-sm border ${selectedText.color === c ? 'ring-2 ring-primary ring-offset-1' : 'border-muted'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => updateTextOverlay(selectedText.id, { bold: !selectedText.bold })}
                      className={`p-1 rounded border ${selectedText.bold ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      <Bold className="h-3 w-3" />
                    </button>
                    <button onClick={() => updateTextOverlay(selectedText.id, { italic: !selectedText.italic })}
                      className={`p-1 rounded border ${selectedText.italic ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      <Italic className="h-3 w-3" />
                    </button>
                    <button onClick={() => updateTextOverlay(selectedText.id, { underline: !selectedText.underline })}
                      className={`p-1 rounded border ${selectedText.underline ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      <Underline className="h-3 w-3" />
                    </button>
                    <div className="w-px bg-border mx-0.5" />
                    <button onClick={() => updateTextOverlay(selectedText.id, { textAlign: 'left' })}
                      className={`p-1 rounded border ${selectedText.textAlign === 'left' ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      <AlignLeft className="h-3 w-3" />
                    </button>
                    <button onClick={() => updateTextOverlay(selectedText.id, { textAlign: 'center' })}
                      className={`p-1 rounded border ${selectedText.textAlign === 'center' ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      <AlignCenter className="h-3 w-3" />
                    </button>
                    <button onClick={() => updateTextOverlay(selectedText.id, { textAlign: 'right' })}
                      className={`p-1 rounded border ${selectedText.textAlign === 'right' ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      <AlignRight className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => updateTextOverlay(selectedText.id, { shadow: !selectedText.shadow })}
                      className={`text-[10px] px-2 py-0.5 rounded border ${selectedText.shadow ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      Shadow
                    </button>
                    <button onClick={() => updateTextOverlay(selectedText.id, { outline: !selectedText.outline })}
                      className={`text-[10px] px-2 py-0.5 rounded border ${selectedText.outline ? 'bg-primary/10 border-primary' : 'border-muted'}`}>
                      Outline
                    </button>
                  </div>
                  <div>
                    <Label className="text-[10px]">Opacity: {Math.round(selectedText.opacity * 100)}%</Label>
                    <input
                      type="range" min={0} max={100} step={5}
                      value={selectedText.opacity * 100}
                      onChange={(e) => updateTextOverlay(selectedText.id, { opacity: Number(e.target.value) / 100 })}
                      className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <Button variant="destructive" size="sm" className="w-full text-[10px] h-6 gap-1" onClick={deleteSelectedOverlay}>
                    <Trash2 className="h-2.5 w-2.5" /> Delete Text
                  </Button>
                  </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Drawing Tools ── */}
          {activeTool === 'draw' && (
            <>
              <SectionHeader id="draw-tools" icon={Pencil} label="Drawing" />
              {!collapsedSections['draw-tools'] && (
                <div className="p-2 space-y-2 border-b">
                  <div className="flex gap-1">
                    {(['pen', 'marker', 'eraser'] as const).map(t => (
                      <button key={t} onClick={() => setDrawTool(t)}
                        className={`text-[10px] px-2 py-1 rounded border capitalize ${drawTool === t ? 'bg-primary/10 border-primary text-primary' : 'border-muted'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div>
                    <Label className="text-[10px]">Color</Label>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {COLOR_PALETTE.slice(0, 12).map(c => (
                        <button
                          key={c}
                          onClick={() => setDrawColor(c)}
                          className={`w-5 h-5 rounded-sm border ${drawColor === c ? 'ring-2 ring-primary ring-offset-1' : 'border-muted'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Brush Size: {drawWidth}px</Label>
                    <div className="flex gap-1 mt-0.5">
                      {BRUSH_SIZES.map(s => (
                        <button key={s} onClick={() => setDrawWidth(s)}
                          className={`w-6 h-6 rounded border flex items-center justify-center ${drawWidth === s ? 'border-primary bg-primary/10' : 'border-muted'}`}>
                          <div className="rounded-full bg-foreground" style={{ width: Math.min(s, 14), height: Math.min(s, 14) }} />
                        </button>
                      ))}
                    </div>
                  </div>
                  {drawStrokes.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full text-[10px] h-6" onClick={() => {
                      pushUndo('Clear drawing');
                      setDrawStrokes([]);
                    }}>
                      <Trash2 className="h-2.5 w-2.5 mr-1" /> Clear All Strokes
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Shape Properties ── */}
          {activeTool === 'shape' && (
            <>
              <SectionHeader id="shape-tools" icon={Square} label="Shapes" />
              {!collapsedSections['shape-tools'] && (
                <div className="p-2 space-y-2 border-b">
                  <div className="flex flex-wrap gap-1">
                    {SHAPE_TYPES.map(s => (
                      <button key={s.value} onClick={() => setShapeType(s.value as ShapeOverlay['type'])}
                        className={`text-[10px] px-2 py-1 rounded border ${shapeType === s.value ? 'bg-primary/10 border-primary text-primary' : 'border-muted'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <div>
                    <Label className="text-[10px]">Stroke Color</Label>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {COLOR_PALETTE.slice(0, 12).map(c => (
                        <button key={c} onClick={() => setShapeColor(c)}
                          className={`w-5 h-5 rounded-sm border ${shapeColor === c ? 'ring-2 ring-primary ring-offset-1' : 'border-muted'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Fill</Label>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      <button onClick={() => setShapeFill('transparent')}
                        className={`w-5 h-5 rounded-sm border ${shapeFill === 'transparent' ? 'ring-2 ring-primary ring-offset-1' : 'border-muted'} bg-[repeating-conic-gradient(#ddd_0%_25%,transparent_0%_50%)] bg-[length:6px_6px]`} />
                      {COLOR_PALETTE.slice(0, 11).map(c => (
                        <button key={c} onClick={() => setShapeFill(c)}
                          className={`w-5 h-5 rounded-sm border ${shapeFill === c ? 'ring-2 ring-primary ring-offset-1' : 'border-muted'}`}
                          style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </div>
                  <Button size="sm" className="w-full text-[10px] h-6 gap-1" onClick={addShape}>
                    <Square className="h-2.5 w-2.5" /> Add Shape
                  </Button>
                  {shapes.length > 0 && (
                    <p className="text-[10px] text-muted-foreground text-center">Drag shapes to reposition</p>
                  )}
                  {selectedOverlayId && shapes.some(s => s.id === selectedOverlayId) && (
                    <Button variant="destructive" size="sm" className="w-full text-[10px] h-6 gap-1" onClick={deleteSelectedOverlay}>
                      <Trash2 className="h-2.5 w-2.5" /> Delete Shape
                    </Button>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Frames ── */}
          <SectionHeader id="frames" icon={Frame} label="Frames & Borders" />
          {!collapsedSections['frames'] && (
            <div className="p-2 border-b">
              <div className="grid grid-cols-3 gap-1">
                {FRAME_PRESETS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFrameSelect(f)}
                    className={`text-[10px] px-1.5 py-1.5 rounded border text-center ${
                      (frame?.id === f.id || (!frame && f.type === 'none'))
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted hover:border-primary/40'
                    }`}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Export Format ── */}
          <SectionHeader id="export-format" icon={Download} label="Export Format" />
          {!collapsedSections['export-format'] && (
            <div className="p-2 space-y-2 border-b">
              <div className="flex gap-1">
                {EXPORT_FORMATS.map(f => (
                  <button
                    key={f.value}
                    onClick={() => setExportFormat(f)}
                    className={`flex-1 text-[10px] px-2 py-1.5 rounded border text-center font-medium ${
                      exportFormat.value === f.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted hover:border-primary/40'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {exportFormat.supportsQuality && (
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px]">Quality</Label>
                    <span className="text-[10px] text-muted-foreground">{exportQuality}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={exportQuality}
                    onChange={(e) => setExportQuality(Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>Smaller file</span>
                    <span>Best quality</span>
                  </div>
                </div>
              )}
              <p className="text-[9px] text-muted-foreground">
                {exportFormat.value === 'png' && 'Lossless, best for graphics with transparency'}
                {exportFormat.value === 'jpeg' && 'Smaller files, great for photos (no transparency)'}
                {exportFormat.value === 'webp' && 'Modern format, smaller files with high quality'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════ STATUS BAR ══════════════ */}
      <div className="flex items-center gap-3 px-3 py-1.5 border rounded-b-lg bg-muted/30 shrink-0">
        {error && (
          <span className="text-[11px] text-destructive flex items-center gap-1.5">
            {error}
            <button onClick={() => setError(null)} className="text-destructive/60 hover:text-destructive">×</button>
          </span>
        )}
        {processing && (
          <span className="text-[11px] text-primary flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Exporting &amp; saving to media library...
          </span>
        )}
        {!error && !processing && (
          <div className="flex items-center gap-2 flex-wrap">
            {editSummary.length > 0 ? (
              <>
                <span className="text-[10px] text-muted-foreground font-medium">Edits:</span>
                {editSummary.map((s, i) => <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>)}
              </>
            ) : (
              <span className="text-[10px] text-muted-foreground">
                {selectedImage ? 'Apply filters, adjustments, or add overlays' : 'Select an image to start editing'}
              </span>
            )}
          </div>
        )}
        {selectedImage && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {naturalWidth}×{naturalHeight} · Original stays untouched
          </span>
        )}
      </div>
    </div>
  );
}
