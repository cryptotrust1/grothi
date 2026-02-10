import { requireAuth } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <div className="md:pl-64 flex flex-col min-h-screen">
        <Topbar
          userName={user.name || user.email}
          creditBalance={user.creditBalance?.balance ?? 0}
        />
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
