import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth, hashPassword, verifyPassword, signOut } from '@/lib/auth';
import { passwordSchema } from '@/lib/validations';
import { createRateLimiter } from '@/lib/rate-limit';

const passwordChangeLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,            // 5 attempts per 15 min
});
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { TwoFactorSetup } from '@/components/dashboard/two-factor-setup';

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
    const rawName = ((formData.get('name') as string) || '').trim();
    const name = rawName.slice(0, 100); // Enforce max length server-side

    await db.user.update({
      where: { id: currentUser.id },
      data: { name: name || currentUser.name },
    });

    redirect('/dashboard/settings?success=Profile updated');
  }

  async function handleChangePassword(formData: FormData) {
    'use server';

    const currentUser = await requireAuth();

    // Rate limit password change attempts per user
    if (!passwordChangeLimiter.check(`pwd:${currentUser.id}`)) {
      redirect('/dashboard/settings?error=' + encodeURIComponent('Too many password change attempts. Please wait 15 minutes.'));
    }

    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;

    if (!currentPassword || !newPassword) {
      redirect('/dashboard/settings?error=' + encodeURIComponent('Please fill in all password fields'));
    }

    // Apply full Zod password validation (uppercase, lowercase, number, common password check)
    const validation = passwordSchema.safeParse(newPassword);
    if (!validation.success) {
      const msg = validation.error.errors[0]?.message || 'Invalid password';
      redirect('/dashboard/settings?error=' + encodeURIComponent(msg));
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

    // Invalidate all existing sessions (security: revoke compromised sessions)
    await db.session.deleteMany({ where: { userId: currentUser.id } });

    // Sign out will create redirect, so we import createSession to make a fresh one
    const { createSession } = await import('@/lib/auth');
    await createSession(currentUser.id);

    redirect('/dashboard/settings?success=Password changed. All other sessions have been signed out.');
  }

  async function handleDeleteAccount() {
    'use server';

    const currentUser = await requireAuth();

    // Clean up media files from disk for all user's bots
    try {
      const { join } = await import('path');
      const { rm } = await import('fs/promises');
      const bots = await db.bot.findMany({ where: { userId: currentUser.id }, select: { id: true } });
      for (const bot of bots) {
        const uploadDir = join(process.cwd(), 'data', 'uploads', bot.id);
        await rm(uploadDir, { recursive: true, force: true });
      }
    } catch {
      // Best effort cleanup
    }

    // Delete user first, then sign out (clear cookie)
    // If signOut runs first, session is gone and delete may fail
    await db.user.delete({ where: { id: currentUser.id } });
    await signOut();
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
              <Input name="name" autoComplete="name" defaultValue={user.name || ''} />
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
              <Input name="currentPassword" type="password" autoComplete="current-password" />
              <p className="text-xs text-muted-foreground">Enter your existing password to verify your identity.</p>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input name="newPassword" type="password" autoComplete="new-password" />
              <p className="text-xs text-muted-foreground">Min 8 characters</p>
            </div>
            <Button type="submit">Change Password</Button>
          </CardContent>
        </form>
      </Card>

      {/* Two-Factor Authentication */}
      <TwoFactorSetup enabled={user.twoFactorEnabled} />

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
