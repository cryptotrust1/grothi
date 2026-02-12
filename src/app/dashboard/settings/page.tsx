import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth, hashPassword, verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export const metadata: Metadata = { title: 'Account Settings', robots: { index: false } };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const user = await requireAuth();
  const sp = await searchParams;

  async function handleUpdateProfile(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const name = formData.get('name') as string;

    await db.user.update({
      where: { id: currentUser.id },
      data: { name: name || currentUser.name },
    });

    redirect('/dashboard/settings?success=Profile updated');
  }

  async function handleChangePassword(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;

    if (!currentPassword || !newPassword) {
      redirect('/dashboard/settings?error=' + encodeURIComponent('Please fill in all password fields'));
    }

    if (newPassword.length < 8) {
      redirect('/dashboard/settings?error=' + encodeURIComponent('New password must be at least 8 characters'));
    }

    const valid = await verifyPassword(currentPassword, currentUser.passwordHash);
    if (!valid) {
      redirect('/dashboard/settings?error=' + encodeURIComponent('Current password is incorrect'));
    }

    const newHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: currentUser.id },
      data: { passwordHash: newHash },
    });

    redirect('/dashboard/settings?success=Password changed');
  }

  async function handleDeleteAccount() {
    'use server';

    const currentUser = await requireAuth();
    await db.user.delete({ where: { id: currentUser.id } });
    redirect('/');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Account Settings</h1>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}
      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
      )}

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your display name and email.</CardDescription>
        </CardHeader>
        <form action={handleUpdateProfile}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input name="name" defaultValue={user.name || ''} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} disabled />
              <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
            </div>
            <Button type="submit">Save Profile</Button>
          </CardContent>
        </form>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Keep your account secure by updating your password regularly.</CardDescription>
        </CardHeader>
        <form action={handleChangePassword}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input name="currentPassword" type="password" />
              <p className="text-xs text-muted-foreground">Enter your existing password to verify your identity.</p>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input name="newPassword" type="password" />
              <p className="text-xs text-muted-foreground">Min 8 characters</p>
            </div>
            <Button type="submit">Change Password</Button>
          </CardContent>
        </form>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete Account</CardTitle>
          <CardDescription>Permanently delete your account and all associated data.</CardDescription>
        </CardHeader>
        <CardContent>
          <ConfirmDialog
            title="Delete Account"
            description="This will permanently delete your account and all associated data including bots, media, and credit history. This action cannot be undone."
            confirmLabel="Delete My Account"
            variant="destructive"
            formAction={handleDeleteAccount}
            trigger={<Button variant="destructive" size="sm">Delete My Account</Button>}
          />
        </CardContent>
      </Card>
    </div>
  );
}
