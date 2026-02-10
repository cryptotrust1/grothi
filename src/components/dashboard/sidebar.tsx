'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Bot,
  CreditCard,
  Settings,
  Plus,
  LogOut,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'My Bots', href: '/dashboard/bots', icon: Bot },
  { name: 'Credits', href: '/dashboard/credits', icon: CreditCard },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0">
      <div className="flex flex-col flex-grow border-r bg-card pt-5 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center px-4 mb-6">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Bot className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold">Grothi</span>
          </Link>
        </div>

        {/* New Bot Button */}
        <div className="px-4 mb-4">
          <Link href="/dashboard/bots/new">
            <Button className="w-full" size="sm">
              <Plus className="mr-2 h-4 w-4" /> New Bot
            </Button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t p-4">
          <form action="/api/auth/signout" method="POST">
            <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" type="submit">
              <LogOut className="mr-3 h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}
