import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { EmailVerificationBanner } from '@/components/dashboard/email-verification-banner';
import { SidebarProvider } from '@/components/dashboard/sidebar-context';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  const bots = await db.bot.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, status: true },
    orderBy: { updatedAt: 'desc' },
  });

  const botInfos = bots.map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
  }));

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-muted/30">
        <Sidebar bots={botInfos} isAdmin={user.role === 'ADMIN'} />
        <DashboardShell>
          <Topbar
            userName={user.name || user.email}
            creditBalance={user.creditBalance?.balance ?? 0}
          />
          {!user.emailVerified && (
            <EmailVerificationBanner userId={user.id} email={user.email} name={user.name || 'there'} />
          )}
          <main className="flex-1 p-4 md:p-6">
            {children}
          </main>
        </DashboardShell>
      </div>
    </SidebarProvider>
  );
}
