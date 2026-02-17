import { requireAdmin } from '@/lib/auth';
import Link from 'next/link';
import { Bot, LayoutDashboard, Users, CreditCard, DollarSign, Settings, MessageSquare } from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Admin header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin" className="flex items-center space-x-2">
              <Bot className="h-6 w-6 text-primary" />
              <span className="font-bold">Grothi Admin</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-1">
              <Link href="/admin" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <LayoutDashboard className="h-4 w-4 inline mr-1" /> Dashboard
              </Link>
              <Link href="/admin/users" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <Users className="h-4 w-4 inline mr-1" /> Users
              </Link>
              <Link href="/admin/bots" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <Bot className="h-4 w-4 inline mr-1" /> Bots
              </Link>
              <Link href="/admin/revenue" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <DollarSign className="h-4 w-4 inline mr-1" /> Revenue
              </Link>
              <Link href="/admin/pricing" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <CreditCard className="h-4 w-4 inline mr-1" /> Pricing
              </Link>
              <Link href="/admin/contacts" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <MessageSquare className="h-4 w-4 inline mr-1" /> Contacts
              </Link>
              <Link href="/admin/settings" className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                <Settings className="h-4 w-4 inline mr-1" /> Settings
              </Link>
            </nav>
          </div>
          <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  );
}
