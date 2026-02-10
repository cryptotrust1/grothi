'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Menu, Bot, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface TopbarProps {
  userName: string;
  creditBalance: number;
}

export function Topbar({ userName, creditBalance }: TopbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        {/* Mobile menu button */}
        <button
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Mobile logo */}
        <Link href="/dashboard" className="md:hidden flex items-center space-x-2">
          <Bot className="h-6 w-6 text-primary" />
          <span className="font-bold">Grothi</span>
        </Link>

        {/* Spacer for desktop */}
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

      {/* Mobile navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-card p-4 space-y-2">
          <Link href="/dashboard" className="block px-3 py-2 rounded-md hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
            Dashboard
          </Link>
          <Link href="/dashboard/bots" className="block px-3 py-2 rounded-md hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
            My Bots
          </Link>
          <Link href="/dashboard/bots/new" className="block px-3 py-2 rounded-md hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
            + New Bot
          </Link>
          <Link href="/dashboard/credits" className="block px-3 py-2 rounded-md hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
            Credits
          </Link>
          <Link href="/dashboard/settings" className="block px-3 py-2 rounded-md hover:bg-muted text-sm" onClick={() => setMobileMenuOpen(false)}>
            Settings
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="block w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm text-destructive">
              Sign Out
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
