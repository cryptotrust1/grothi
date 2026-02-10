import Link from 'next/link';
import { BOT_NAV_TABS } from '@/lib/constants';

interface BotNavProps {
  botId: string;
  activeTab: typeof BOT_NAV_TABS[number]['key'];
}

export function BotNav({ botId, activeTab }: BotNavProps) {
  return (
    <div className="flex flex-wrap gap-4 mt-4 border-b pb-2">
      {BOT_NAV_TABS.map((tab) => {
        const isActive = tab.key === activeTab;
        const href = `/dashboard/bots/${botId}${tab.path}`;
        return (
          <Link
            key={tab.key}
            href={href}
            className={
              isActive
                ? 'text-sm font-medium border-b-2 border-primary pb-2'
                : 'text-sm text-muted-foreground hover:text-foreground pb-2'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
