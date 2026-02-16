import { requireAuth } from '@/lib/auth';
import { Sidebar } from '@/components/dashboard/sidebar';
import { Topbar } from '@/components/dashboard/topbar';
import { EmailVerificationBanner } from '@/components/dashboard/email-verification-banner';

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
        {!user.emailVerified && (
          <EmailVerificationBanner userId={user.id} email={user.email} name={user.name || 'there'} />
        )}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
