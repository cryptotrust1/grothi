import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const metadata: Metadata = { title: 'Admin - Pricing', robots: { index: false } };

export default async function AdminPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const [plans, actionCosts, promoCodes] = await Promise.all([
    db.pricingPlan.findMany({ orderBy: { sortOrder: 'asc' } }),
    db.actionCost.findMany(),
    db.promoCode.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  async function handleCreatePlan(formData: FormData) {
    'use server';
    await requireAdmin();

    const name = (formData.get('name') as string)?.trim();
    const creditsRaw = parseInt(formData.get('credits') as string, 10);
    const priceRaw = parseInt(formData.get('priceUsd') as string, 10);

    if (!name || isNaN(creditsRaw) || isNaN(priceRaw) || creditsRaw <= 0 || priceRaw <= 0) {
      redirect('/admin/pricing?error=' + encodeURIComponent('Name, credits (>0), and price (>0) are required'));
    }

    let errorMessage: string | null = null;
    try {
      await db.pricingPlan.create({
        data: {
          name,
          credits: creditsRaw,
          priceUsd: priceRaw,
          isPopular: formData.get('isPopular') === 'on',
          sortOrder: plans.length,
        },
      });
    } catch (error) {
      console.error('Create plan error:', error);
      errorMessage = 'Failed to create plan. Please try again.';
    }

    if (errorMessage) {
      redirect('/admin/pricing?error=' + encodeURIComponent(errorMessage));
    }
    redirect('/admin/pricing?success=Plan+created');
  }

  async function handleCreatePromo(formData: FormData) {
    'use server';
    await requireAdmin();

    const code = (formData.get('code') as string)?.trim();
    if (!code) {
      redirect('/admin/pricing?error=' + encodeURIComponent('Promo code is required'));
    }

    const discountPct = parseInt(formData.get('discountPct') as string, 10);
    const bonusCredits = parseInt(formData.get('bonusCredits') as string, 10);
    const maxUsesRaw = parseInt(formData.get('maxUses') as string, 10);

    if (!isNaN(discountPct) && (discountPct < 0 || discountPct > 100)) {
      redirect('/admin/pricing?error=' + encodeURIComponent('Discount must be between 0 and 100%'));
    }

    let errorMessage: string | null = null;
    try {
      await db.promoCode.create({
        data: {
          code: code.toUpperCase(),
          discountPct: isNaN(discountPct) ? 0 : discountPct,
          bonusCredits: isNaN(bonusCredits) ? 0 : bonusCredits,
          maxUses: isNaN(maxUsesRaw) ? null : maxUsesRaw,
        },
      });
    } catch (error) {
      console.error('Create promo error:', error);
      errorMessage = 'Failed to create promo code. It may already exist.';
    }

    if (errorMessage) {
      redirect('/admin/pricing?error=' + encodeURIComponent(errorMessage));
    }
    redirect('/admin/pricing?success=Promo+code+created');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing Management</h1>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
      )}
      {sp.error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">{sp.error}</div>
      )}

      {/* Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Credit Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length > 0 && (
            <div className="space-y-2 mb-6">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{plan.name}</span>
                    {plan.isPopular && <Badge>Popular</Badge>}
                    {!plan.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <div className="text-right">
                    <span>{plan.credits.toLocaleString()} credits</span>
                    <span className="text-muted-foreground ml-2">${(plan.priceUsd / 100).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form action={handleCreatePlan} className="grid gap-3 sm:grid-cols-4 items-end">
            <div>
              <Label className="text-xs">Plan Name</Label>
              <Input name="name" placeholder="Pro Plus" required />
            </div>
            <div>
              <Label className="text-xs">Credits</Label>
              <Input name="credits" type="number" placeholder="5000" required />
            </div>
            <div>
              <Label className="text-xs">Price (cents)</Label>
              <Input name="priceUsd" type="number" placeholder="4500" required />
            </div>
            <Button type="submit">Add Plan</Button>
          </form>
        </CardContent>
      </Card>

      {/* Action Costs */}
      <Card>
        <CardHeader>
          <CardTitle>Action Costs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Default costs are hardcoded. Override them by adding entries to the ActionCost table.
          </p>
          <div className="space-y-2">
            {['GENERATE_CONTENT:5', 'POST:2', 'REPLY:3', 'FAVOURITE:1', 'BOOST:1', 'SCAN_FEEDS:2', 'COLLECT_METRICS:1'].map((item) => {
              const [action, cost] = item.split(':');
              const override = actionCosts.find((ac) => ac.actionType === action);
              return (
                <div key={action} className="flex items-center justify-between py-1 text-sm">
                  <span>{action}</span>
                  <span className="font-medium">
                    {override ? `${override.credits} credits (custom)` : `${cost} credits (default)`}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Promo Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Promo Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {promoCodes.length > 0 && (
            <div className="space-y-2 mb-6">
              {promoCodes.map((code) => (
                <div key={code.id} className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">{code.code}</Badge>
                    {!code.isActive && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {code.discountPct > 0 && `${code.discountPct}% off`}
                    {code.bonusCredits > 0 && ` +${code.bonusCredits} bonus`}
                    {code.maxUses && ` (${code.usedCount}/${code.maxUses} used)`}
                  </div>
                </div>
              ))}
            </div>
          )}
          <form action={handleCreatePromo} className="grid gap-3 sm:grid-cols-5 items-end">
            <div>
              <Label className="text-xs">Code</Label>
              <Input name="code" placeholder="WELCOME50" required />
            </div>
            <div>
              <Label className="text-xs">Discount %</Label>
              <Input name="discountPct" type="number" placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Bonus Credits</Label>
              <Input name="bonusCredits" type="number" placeholder="100" />
            </div>
            <div>
              <Label className="text-xs">Max Uses</Label>
              <Input name="maxUses" type="number" placeholder="100" />
            </div>
            <Button type="submit">Add Code</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
