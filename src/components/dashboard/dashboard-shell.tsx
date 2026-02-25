'use client';

import { cn } from '@/lib/utils';
import { useSidebar } from '@/components/dashboard/sidebar-context';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();

  return (
    <div
      className={cn(
        'flex flex-col min-h-screen transition-all duration-200',
        collapsed ? 'md:pl-16' : 'md:pl-64'
      )}
    >
      {children}
    </div>
  );
}
