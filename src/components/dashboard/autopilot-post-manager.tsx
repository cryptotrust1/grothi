'use client';

import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2, Trash2, Clock, ChevronLeft, ChevronRight, List, CalendarDays,
  Eye, Pencil, X, Save, ImageIcon, Film, ExternalLink,
  Heart, MessageCircle, Send, Bookmark, Share2, ThumbsUp,
  Repeat2, MoreHorizontal,
} from 'lucide-react';

// ── Types ──

export interface AutopilotPost {
  id: string;
  content: string;
  contentType: string | null;
  contentFormat: string | null;
  platforms: string[];
  scheduledAt: string | null;  // ISO string
  mediaId: string | null;
  mediaType: string | null;    // IMAGE or VIDEO
  productId: string | null;
  productName: string | null;
  status: string;
  error: string | null;
}

interface AutopilotPostManagerProps {
  posts: AutopilotPost[];
  botId: string;
  botPageId: string;
  platformNames: Record<string, string>;
  onApprove: (postId: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
}

// ── Platform Preview Styles ──

const PLATFORM_STYLES: Record<string, {
  bg: string;
  accent: string;
  avatar: string;
  icon: string;
  maxChars: number;
}> = {
  INSTAGRAM: { bg: 'bg-white', accent: 'text-pink-600', avatar: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400', icon: '📸', maxChars: 2200 },
  FACEBOOK: { bg: 'bg-white', accent: 'text-blue-600', avatar: 'bg-blue-500', icon: '📘', maxChars: 63206 },
  THREADS: { bg: 'bg-white', accent: 'text-black', avatar: 'bg-black', icon: '🧵', maxChars: 500 },
  TWITTER: { bg: 'bg-white', accent: 'text-black', avatar: 'bg-black', icon: '𝕏', maxChars: 280 },
  TIKTOK: { bg: 'bg-black text-white', accent: 'text-pink-500', avatar: 'bg-pink-500', icon: '🎵', maxChars: 2200 },
  LINKEDIN: { bg: 'bg-white', accent: 'text-blue-700', avatar: 'bg-blue-700', icon: '💼', maxChars: 3000 },
  YOUTUBE: { bg: 'bg-white', accent: 'text-red-600', avatar: 'bg-red-600', icon: '▶️', maxChars: 5000 },
  PINTEREST: { bg: 'bg-white', accent: 'text-red-700', avatar: 'bg-red-600', icon: '📌', maxChars: 500 },
  REDDIT: { bg: 'bg-white', accent: 'text-orange-600', avatar: 'bg-orange-500', icon: '🟠', maxChars: 40000 },
  MASTODON: { bg: 'bg-white', accent: 'text-purple-600', avatar: 'bg-purple-600', icon: '🐘', maxChars: 500 },
  BLUESKY: { bg: 'bg-white', accent: 'text-blue-500', avatar: 'bg-blue-500', icon: '🦋', maxChars: 300 },
  TELEGRAM: { bg: 'bg-white', accent: 'text-blue-500', avatar: 'bg-blue-500', icon: '✈️', maxChars: 4096 },
  DISCORD: { bg: 'bg-[#36393f] text-white', accent: 'text-indigo-400', avatar: 'bg-indigo-500', icon: '💬', maxChars: 2000 },
  MEDIUM: { bg: 'bg-white', accent: 'text-black', avatar: 'bg-black', icon: '📝', maxChars: 100000 },
  DEVTO: { bg: 'bg-white', accent: 'text-black', avatar: 'bg-black', icon: '👨‍💻', maxChars: 100000 },
};

// ── Platform Post Preview Component ──

function PlatformPostPreview({ post, platform, platformName }: {
  post: AutopilotPost;
  platform: string;
  platformName: string;
}) {
  const style = PLATFORM_STYLES[platform] || PLATFORM_STYLES.TWITTER;
  const isPlaceholder = post.content.startsWith('[AUTOPILOT]') || post.content.startsWith('[GENERATING]');
  const content = isPlaceholder ? 'AI is generating content...' : post.content;

  // Instagram-style preview
  if (platform === 'INSTAGRAM') {
    return (
      <div className={`rounded-lg border overflow-hidden ${style.bg} text-sm`}>
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2">
          <div className={`w-8 h-8 rounded-full ${style.avatar} flex items-center justify-center text-white text-xs font-bold`}>A</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-xs truncate">acechange</p>
            <p className="text-[10px] text-muted-foreground">{post.scheduledAt ? formatScheduleDate(post.scheduledAt) : 'Not scheduled'}</p>
          </div>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
        {/* Media */}
        {post.mediaId ? (
          <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
            {post.mediaType === 'VIDEO' ? (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <Film className="h-12 w-12 text-white/50" />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/api/media/${post.mediaId}`} alt="" className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
        ) : (
          <div className="aspect-[4/3] bg-gradient-to-br from-purple-100 to-pink-50 flex items-center justify-center">
            <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center gap-4 px-3 py-2">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <div className="flex-1" />
          <Bookmark className="h-5 w-5" />
        </div>
        {/* Content */}
        <div className="px-3 pb-3">
          <p className="text-xs leading-relaxed line-clamp-4">
            <span className="font-semibold mr-1">acechange</span>
            {content}
          </p>
        </div>
      </div>
    );
  }

  // Facebook-style preview
  if (platform === 'FACEBOOK') {
    return (
      <div className={`rounded-lg border overflow-hidden ${style.bg} text-sm`}>
        <div className="flex items-center gap-2 px-3 py-2">
          <div className={`w-10 h-10 rounded-full ${style.avatar} flex items-center justify-center text-white text-sm font-bold`}>A</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">AceChange</p>
            <p className="text-[11px] text-muted-foreground">{post.scheduledAt ? formatScheduleDate(post.scheduledAt) : 'Not scheduled'} · 🌐</p>
          </div>
          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="px-3 pb-2">
          <p className="text-sm leading-relaxed line-clamp-4">{content}</p>
        </div>
        {post.mediaId && (
          <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
            {post.mediaType === 'VIDEO' ? (
              <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                <Film className="h-12 w-12 text-white/50" />
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={`/api/media/${post.mediaId}`} alt="" className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
        )}
        <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
          <button className="flex items-center gap-1 hover:text-blue-600"><ThumbsUp className="h-4 w-4" /> Like</button>
          <button className="flex items-center gap-1 hover:text-blue-600"><MessageCircle className="h-4 w-4" /> Comment</button>
          <button className="flex items-center gap-1 hover:text-blue-600"><Share2 className="h-4 w-4" /> Share</button>
        </div>
      </div>
    );
  }

  // Threads-style preview
  if (platform === 'THREADS') {
    return (
      <div className={`rounded-lg border overflow-hidden ${style.bg} text-sm`}>
        <div className="flex gap-3 p-3">
          <div className="flex flex-col items-center">
            <div className={`w-9 h-9 rounded-full ${style.avatar} flex items-center justify-center text-white text-xs font-bold`}>A</div>
            <div className="w-0.5 flex-1 bg-muted mt-2" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-sm">acechange</span>
              <span className="text-muted-foreground text-xs">{post.scheduledAt ? formatRelativeTime(post.scheduledAt) : ''}</span>
            </div>
            <p className="text-sm mt-1 leading-relaxed line-clamp-4">{content}</p>
            {post.mediaId && (
              <div className="mt-2 rounded-lg overflow-hidden border aspect-video bg-muted flex items-center justify-center">
                {post.mediaType === 'VIDEO' ? (
                  <Film className="h-8 w-8 text-muted-foreground/40" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`/api/media/${post.mediaId}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
            )}
            <div className="flex items-center gap-4 mt-2 text-muted-foreground">
              <Heart className="h-4 w-4" />
              <MessageCircle className="h-4 w-4" />
              <Repeat2 className="h-4 w-4" />
              <Send className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Twitter/X-style preview
  if (platform === 'TWITTER') {
    return (
      <div className={`rounded-lg border overflow-hidden ${style.bg} text-sm`}>
        <div className="flex gap-3 p-3">
          <div className={`w-10 h-10 rounded-full ${style.avatar} flex items-center justify-center text-white text-xs font-bold shrink-0`}>A</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm">AceChange</span>
              <span className="text-muted-foreground text-sm">@acechange</span>
              <span className="text-muted-foreground text-sm">·</span>
              <span className="text-muted-foreground text-sm">{post.scheduledAt ? formatRelativeTime(post.scheduledAt) : ''}</span>
            </div>
            <p className="text-sm mt-1 leading-relaxed line-clamp-4">{content}</p>
            {post.mediaId && (
              <div className="mt-2 rounded-xl overflow-hidden border aspect-video bg-muted flex items-center justify-center">
                {post.mediaType === 'VIDEO' ? (
                  <Film className="h-8 w-8 text-muted-foreground/40" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={`/api/media/${post.mediaId}`} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 text-muted-foreground max-w-[280px]">
              <MessageCircle className="h-4 w-4" />
              <Repeat2 className="h-4 w-4" />
              <Heart className="h-4 w-4" />
              <Bookmark className="h-4 w-4" />
              <Share2 className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Generic preview for other platforms
  return (
    <div className="rounded-lg border overflow-hidden bg-white text-sm">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <div className={`w-7 h-7 rounded-full ${style.avatar} flex items-center justify-center text-white text-[11px]`}>
          {style.icon}
        </div>
        <span className="font-semibold text-xs">{platformName}</span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {post.scheduledAt ? formatScheduleDate(post.scheduledAt) : 'Not scheduled'}
        </span>
      </div>
      {post.mediaId && (
        <div className="aspect-video bg-muted flex items-center justify-center overflow-hidden">
          {post.mediaType === 'VIDEO' ? (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <Film className="h-10 w-10 text-white/50" />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/media/${post.mediaId}`} alt="" className="w-full h-full object-cover" loading="lazy" />
          )}
        </div>
      )}
      <div className="p-3">
        <p className="text-sm leading-relaxed line-clamp-4">{content}</p>
      </div>
    </div>
  );
}

// ── Post Card with Preview, Edit, Delete ──

function AutopilotPostCard({
  post, platformNames, onApprove, onDelete, onEdit,
}: {
  post: AutopilotPost;
  platformNames: Record<string, string>;
  onApprove: (postId: string) => void;
  onDelete: (postId: string) => void;
  onEdit: (postId: string, content: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [showPreview, setShowPreview] = useState(false);

  const isPlaceholder = post.content.startsWith('[AUTOPILOT]') || post.content.startsWith('[GENERATING]');
  const platforms = post.platforms || [];
  const primaryPlatform = platforms[0] || 'TWITTER';

  const handleSaveEdit = () => {
    onEdit(post.id, editContent);
    setIsEditing(false);
  };

  const statusColor = {
    DRAFT: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    SCHEDULED: 'bg-blue-100 text-blue-800 border-blue-200',
    PUBLISHED: 'bg-green-100 text-green-800 border-green-200',
    FAILED: 'bg-red-100 text-red-800 border-red-200',
    PUBLISHING: 'bg-violet-100 text-violet-800 border-violet-200',
    CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
  }[post.status] || 'bg-gray-100 text-gray-800 border-gray-200';

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {platforms.map(p => (
            <Badge key={p} variant="secondary" className="text-[10px]">
              {platformNames[p] || p}
            </Badge>
          ))}
          {post.contentType && (
            <Badge variant="outline" className="text-[10px]">{post.contentType}</Badge>
          )}
          {post.contentFormat && (
            <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 bg-green-50">
              {post.contentFormat}
            </Badge>
          )}
          {post.productName && (
            <Badge className="text-[10px]">{post.productName}</Badge>
          )}
          <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
            {post.status}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`p-1 rounded hover:bg-muted transition-colors ${showPreview ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
            title="Preview"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {!isPlaceholder && (
            <button
              onClick={() => { setIsEditing(!isEditing); setEditContent(post.content); }}
              className={`p-1 rounded hover:bg-muted transition-colors ${isEditing ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onDelete(post.id)}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex gap-0">
        {/* Content / Edit Area */}
        <div className="flex-1 p-3 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveEdit} className="gap-1 text-xs h-7">
                  <Save className="h-3 w-3" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-xs h-7">
                  Cancel
                </Button>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {editContent.length} chars
                </span>
              </div>
            </div>
          ) : (
            <>
              <p className={`text-sm leading-relaxed ${isPlaceholder ? 'text-muted-foreground italic' : ''} ${showPreview ? '' : 'line-clamp-3'}`}>
                {isPlaceholder ? 'AI is generating content for this post...' : post.content}
              </p>
              {post.error && (
                <p className="text-xs text-destructive mt-1">Error: {post.error}</p>
              )}
            </>
          )}

          {/* Schedule & Actions */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.scheduledAt ? formatScheduleDate(post.scheduledAt) : 'Not scheduled'}
            </span>
            <div className="flex-1" />
            {post.status === 'DRAFT' && !isPlaceholder && (
              <Button size="sm" variant="default" className="gap-1 text-xs h-6" onClick={() => onApprove(post.id)}>
                <CheckCircle2 className="h-3 w-3" /> Approve
              </Button>
            )}
          </div>
        </div>

        {/* Platform Preview (when toggled) */}
        {showPreview && (
          <div className="w-[300px] shrink-0 border-l p-2 bg-muted/20">
            <PlatformPostPreview
              post={post}
              platform={primaryPlatform}
              platformName={platformNames[primaryPlatform] || primaryPlatform}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar View ──

function AutopilotCalendar({ posts, platformNames }: {
  posts: AutopilotPost[];
  platformNames: Record<string, string>;
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const daysInMonth = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentMonth.year, currentMonth.month, 1).getDay();
  const monthName = new Date(currentMonth.year, currentMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const postsByDate = useMemo(() => {
    const map: Record<string, AutopilotPost[]> = {};
    for (const post of posts) {
      if (post.scheduledAt) {
        const dateKey = post.scheduledAt.split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(post);
      }
    }
    return map;
  }, [posts]);

  const prevMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { ...prev, month: prev.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { ...prev, month: prev.month + 1 };
    });
  };

  const today = new Date().toISOString().split('T')[0];

  const statusDot: Record<string, string> = {
    DRAFT: 'bg-yellow-400',
    SCHEDULED: 'bg-blue-400',
    PUBLISHED: 'bg-green-400',
    FAILED: 'bg-red-400',
    PUBLISHING: 'bg-violet-400',
  };

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <button onClick={prevMonth} className="p-1 rounded hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
        <span className="font-semibold text-sm">{monthName}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1.5 border-r last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {/* Empty cells before first day */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] border-r border-b last:border-r-0 bg-muted/20" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateKey = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayPosts = postsByDate[dateKey] || [];
          const isToday = dateKey === today;

          return (
            <div
              key={day}
              className={`min-h-[80px] border-r border-b last:border-r-0 p-1 ${isToday ? 'bg-blue-50/50' : ''}`}
            >
              <div className={`text-[11px] font-medium mb-0.5 ${isToday ? 'text-blue-700 font-bold' : 'text-muted-foreground'}`}>
                {day}
              </div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 4).map(post => {
                  const platform = (post.platforms || [])[0] || '';
                  const pStyle = PLATFORM_STYLES[platform];
                  return (
                    <div
                      key={post.id}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-[9px] leading-tight bg-muted/60 hover:bg-muted cursor-default group"
                      title={`${platformNames[platform] || platform} — ${post.contentType || 'post'}\n${post.content.substring(0, 100)}...\nStatus: ${post.status}`}
                    >
                      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot[post.status] || 'bg-gray-400'}`} />
                      <span className="truncate">
                        {pStyle?.icon || '📝'} {post.contentType || 'post'}
                      </span>
                    </div>
                  );
                })}
                {dayPosts.length > 4 && (
                  <p className="text-[9px] text-muted-foreground text-center">+{dayPosts.length - 4} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" /> Draft</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Scheduled</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" /> Published</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Failed</span>
      </div>
    </div>
  );
}

// ── Main Component ──

export function AutopilotPostManager({
  posts, botId, botPageId, platformNames, onApprove, onDelete, onEdit,
}: AutopilotPostManagerProps) {
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [deleting, setDeleting] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    if (statusFilter === 'ALL') return posts;
    return posts.filter(p => p.status === statusFilter);
  }, [posts, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: posts.length };
    for (const p of posts) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    }
    return counts;
  }, [posts]);

  const handleDelete = useCallback((postId: string) => {
    if (deleting) return;
    setDeleting(postId);
    onDelete(postId);
  }, [deleting, onDelete]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Status Filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {['ALL', 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-muted hover:border-primary/40 text-muted-foreground'
              }`}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              {statusCounts[status] ? ` (${statusCounts[status]})` : ''}
            </button>
          ))}
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setView('list')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'list' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-3.5 w-3.5" /> List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              view === 'calendar' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </button>
        </div>
      </div>

      {/* Content */}
      {view === 'list' ? (
        <div className="space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} posts found
            </div>
          ) : (
            filteredPosts.map(post => (
              <AutopilotPostCard
                key={post.id}
                post={post}
                platformNames={platformNames}
                onApprove={onApprove}
                onDelete={handleDelete}
                onEdit={onEdit}
              />
            ))
          )}
        </div>
      ) : (
        <AutopilotCalendar posts={posts} platformNames={platformNames} />
      )}
    </div>
  );
}

// ── Helpers ──

function formatScheduleDate(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatRelativeTime(isoStr: string): string {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.abs(Math.round(diff / (1000 * 60 * 60 * 24)));
  if (days === 0) return 'today';
  if (days === 1) return diff > 0 ? 'tomorrow' : 'yesterday';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
