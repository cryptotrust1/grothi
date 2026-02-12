import Link from 'next/link';
import { BOT_NAV_TABS } from '@/lib/constants';

interface BotNavProps {
  botId: string;
  activeTab: typeof BOT_NAV_TABS[number]['key'];
}

export function BotNav({ botId, activeTab }: BotNavProps) {
  return (
    <div className="overflow-x-auto -mx-1 mt-4 border-b">
      <div className="flex gap-4 px-1 min-w-max pb-0">
        {BOT_NAV_TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const href = `/dashboard/bots/${botId}${tab.path}`;
          return (
            <Link
              key={tab.key}
              href={href}
              className={
                isActive
                  ? 'text-sm font-medium border-b-2 border-primary pb-2 whitespace-nowrap'
                  : 'text-sm text-muted-foreground hover:text-foreground pb-2 whitespace-nowrap'
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
