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
  searchParams: Promise<{ success?: string }>;
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

    await db.pricingPlan.create({
      data: {
        name: formData.get('name') as string,
        credits: parseInt(formData.get('credits') as string, 10),
        priceUsd: parseInt(formData.get('priceUsd') as string, 10),
        isPopular: formData.get('isPopular') === 'on',
        sortOrder: plans.length,
      },
    });

    redirect('/admin/pricing?success=Plan created');
  }

  async function handleCreatePromo(formData: FormData) {
    'use server';
    await requireAdmin();

    await db.promoCode.create({
      data: {
        code: (formData.get('code') as string).toUpperCase(),
        discountPct: parseInt(formData.get('discountPct') as string, 10) || 0,
        bonusCredits: parseInt(formData.get('bonusCredits') as string, 10) || 0,
        maxUses: parseInt(formData.get('maxUses') as string, 10) || null,
      },
    });

    redirect('/admin/pricing?success=Promo code created');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pricing Management</h1>

      {sp.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800">{sp.success}</div>
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
