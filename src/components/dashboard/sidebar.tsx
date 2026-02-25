'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { BOT_NAV_TABS, BOT_NAV_GROUPS, BOT_STATUS_CONFIG } from '@/lib/constants';
import { useSidebar } from '@/components/dashboard/sidebar-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  Bot,
  CreditCard,
  Settings,
  Plus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Zap,
  CalendarDays,
  Target,
  Globe,
  Mail,
  ImageIcon,
  Film,
  ShoppingBag,
  Palette,
  Activity,
  BarChart3,
  Sparkles,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Map icon string names from constants to actual icon components
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Zap,
  CalendarDays,
  Target,
  Globe,
  Mail,
  ImageIcon,
  Film,
  ShoppingBag,
  Palette,
  Activity,
  BarChart3,
  Sparkles,
  Settings,
};

interface BotInfo {
  id: string;
  name: string;
  status: string;
}

interface SidebarProps {
  bots?: BotInfo[];
  isAdmin?: boolean;
}

const mainNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'My Bots', href: '/dashboard/bots', icon: Bot, exact: false },
  { name: 'Credits', href: '/dashboard/credits', icon: CreditCard, exact: false },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, exact: false },
];

function extractBotId(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/bots\/([^/]+)/);
  if (match && match[1] !== 'new') {
    return match[1];
  }
  return null;
}

function getActiveTabKey(pathname: string, botId: string): string {
  const basePath = `/dashboard/bots/${botId}`;
  if (pathname === basePath) return 'overview';
  const sub = pathname.slice(basePath.length);
  for (const tab of BOT_NAV_TABS) {
    if (tab.path && sub.startsWith(tab.path)) return tab.key;
  }
  return 'overview';
}

export function Sidebar({ bots = [], isAdmin = false }: SidebarProps) {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  const currentBotId = extractBotId(pathname);
  const currentBot = currentBotId
    ? bots.find((b) => b.id === currentBotId) ?? null
    : null;
  const activeTabKey = currentBotId ? getActiveTabKey(pathname, currentBotId) : null;

  const isOnBotPage = currentBotId !== null;

  // Group bot tabs by their group field
  const groupedTabs = isOnBotPage
    ? Object.entries(BOT_NAV_GROUPS).map(([groupKey, groupLabel]) => ({
        key: groupKey,
        label: groupLabel,
        tabs: BOT_NAV_TABS.filter((t) => t.group === groupKey),
      }))
    : [];
  const ungroupedTabs = BOT_NAV_TABS.filter((t) => t.group === null);

  function renderNavLink(
    href: string,
    label: string,
    IconComponent: LucideIcon,
    isActive: boolean,
    onClick?: () => void,
  ) {
    if (collapsed) {
      return (
        <Tooltip key={href}>
          <TooltipTrigger asChild>
            <Link
              href={href}
              onClick={onClick}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-md transition-colors mx-auto',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <IconComponent className="h-5 w-5 flex-shrink-0" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }

    return (
      <Link
        key={href}
        href={href}
        onClick={onClick}
        className={cn(
          'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        )}
      >
        <IconComponent className="mr-3 h-5 w-5 flex-shrink-0" />
        {label}
      </Link>
    );
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header: Logo + Collapse Toggle */}
      <div className={cn(
        'flex items-center border-b h-14 flex-shrink-0',
        collapsed ? 'justify-center px-2' : 'justify-between px-4'
      )}>
        {collapsed ? (
          <Link href="/dashboard" className="flex items-center justify-center">
            <Bot className="h-7 w-7 text-primary" />
          </Link>
        ) : (
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Bot className="h-7 w-7 text-primary" />
            <span className="text-lg font-bold">Grothi</span>
          </Link>
        )}
        {/* Collapse toggle - desktop only */}
        <button
          onClick={toggleCollapsed}
          className={cn(
            'hidden md:flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
            collapsed && 'mx-auto mt-2'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {/* Close button - mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* New Bot Button */}
      {!isOnBotPage && (
        <div className={cn('flex-shrink-0', collapsed ? 'px-2 py-3' : 'px-3 py-3')}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/dashboard/bots/new">
                  <Button size="icon" className="w-10 h-10 mx-auto flex">
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">New Bot</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/dashboard/bots/new">
              <Button className="w-full" size="sm">
                <Plus className="mr-2 h-4 w-4" /> New Bot
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Bot Context Header */}
      {isOnBotPage && currentBot && (
        <div className={cn(
          'flex-shrink-0 border-b',
          collapsed ? 'px-2 py-3' : 'px-3 py-3'
        )}>
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/dashboard/bots"
                  className="flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mx-auto"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Back to Bots</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Link
                href="/dashboard/bots"
                className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                Back to Bots
              </Link>
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm font-semibold truncate">{currentBot.name}</span>
              </div>
              {BOT_STATUS_CONFIG[currentBot.status] && (
                <Badge
                  variant={BOT_STATUS_CONFIG[currentBot.status].variant}
                  className="mt-1.5 text-[10px]"
                >
                  {BOT_STATUS_CONFIG[currentBot.status].label}
                </Badge>
              )}
            </>
          )}
        </div>
      )}

      {/* Navigation - scrollable area */}
      <nav className={cn(
        'flex-1 overflow-y-auto py-2',
        collapsed ? 'px-1' : 'px-2'
      )}>
        {isOnBotPage && currentBotId ? (
          <>
            {/* Bot navigation grouped */}
            {groupedTabs.map((group) => (
              <div key={group.key} className="mb-1">
                {!collapsed && (
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.tabs.map((tab) => {
                    const IconComponent = ICON_MAP[tab.icon] || LayoutDashboard;
                    const href = `/dashboard/bots/${currentBotId}${tab.path}`;
                    const isActive = tab.key === activeTabKey;
                    return renderNavLink(
                      href,
                      tab.label,
                      IconComponent,
                      isActive,
                      () => setMobileOpen(false),
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Ungrouped tabs (Settings) */}
            {ungroupedTabs.length > 0 && (
              <div className={cn('mt-1 pt-1', !collapsed && 'border-t')}>
                {ungroupedTabs.map((tab) => {
                  const IconComponent = ICON_MAP[tab.icon] || Settings;
                  const href = `/dashboard/bots/${currentBotId}${tab.path}`;
                  const isActive = tab.key === activeTabKey;
                  return renderNavLink(
                    href,
                    tab.label,
                    IconComponent,
                    isActive,
                    () => setMobileOpen(false),
                  );
                })}
              </div>
            )}

            {/* Account quick links */}
            <div className={cn(
              'mt-3 pt-3 border-t',
              collapsed ? '' : ''
            )}>
              {!collapsed && (
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                  Account
                </div>
              )}
              <div className="space-y-0.5">
                {renderNavLink('/dashboard', 'Dashboard', LayoutDashboard, false, () => setMobileOpen(false))}
                {renderNavLink('/dashboard/credits', 'Credits', CreditCard, false, () => setMobileOpen(false))}
              </div>
            </div>
          </>
        ) : (
          /* Main navigation (not in bot context) */
          <div className="space-y-0.5">
            {mainNavigation.map((item) => {
              const isActive = item.exact
                ? pathname === item.href
                : pathname === item.href || (pathname.startsWith(item.href + '/') && !extractBotId(pathname));
              return renderNavLink(
                item.href,
                item.name,
                item.icon,
                isActive,
                () => setMobileOpen(false),
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom section - Sign Out */}
      <div className={cn('border-t flex-shrink-0', collapsed ? 'p-2' : 'p-3')}>
        <form action="/api/auth/signout" method="POST">
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 mx-auto flex text-muted-foreground"
                  type="submit"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign Out</TooltipContent>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" type="submit">
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          )}
        </form>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r bg-card transition-all duration-200 z-30',
          collapsed ? 'md:w-16' : 'md:w-64'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r z-50 md:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </TooltipProvider>
  );
}
