'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Menu, Bot } from 'lucide-react';
import { useSidebar } from '@/components/dashboard/sidebar-context';

interface TopbarProps {
  userName: string;
  creditBalance: number;
}

export function Topbar({ userName, creditBalance }: TopbarProps) {
  const { setMobileOpen } = useSidebar();

  return (
    <header className="sticky top-0 z-20 border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Mobile: hamburger + logo */}
        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Bot className="h-6 w-6 text-primary" />
            <span className="font-bold">Grothi</span>
          </Link>
        </div>

        {/* Desktop spacer */}
        <div className="hidden md:block" />

        {/* Right side */}
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/credits">
            <Badge variant="outline" className="cursor-pointer hover:bg-muted">
              <CreditCard className="mr-1 h-3 w-3" />
              {creditBalance.toLocaleString()} credits
            </Badge>
          </Link>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            {userName}
          </span>
        </div>
      </div>
    </header>
  );
}
