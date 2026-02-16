import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BotNav } from '@/components/dashboard/bot-nav';
import {
  ArrowLeft, BarChart3, Mail, Eye, MousePointer,
  AlertTriangle, Ban, TrendingUp, Users, Shield,
  CheckCircle2, AlertCircle, Info,
} from 'lucide-react';
import { CAMPAIGN_STATUS_CONFIG, EMAIL_DELIVERABILITY_THRESHOLDS } from '@/lib/constants';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Email Analytics',
  robots: { index: false },
};

export default async function EmailAnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;

  const bot = await db.bot.findFirst({
    where: { id, userId: user.id },
    include: {
      emailAccount: true,
      emailCampaigns: {
        orderBy: { createdAt: 'desc' },
      },
      emailLists: {
        include: { _count: { select: { contacts: true } } },
      },
    },
  });

  if (!bot) notFound();

  const campaigns = bot.emailCampaigns;
  const sentCampaigns = campaigns.filter(c => c.status === 'SENT');

  // Aggregate stats
  const totalSent = sentCampaigns.reduce((s, c) => s + c.totalSent, 0);
  const totalOpened = sentCampaigns.reduce((s, c) => s + c.totalOpened, 0);
  const totalClicked = sentCampaigns.reduce((s, c) => s + c.totalClicked, 0);
  const totalBounced = sentCampaigns.reduce((s, c) => s + c.totalBounced, 0);
  const totalUnsubscribed = sentCampaigns.reduce((s, c) => s + c.totalUnsubscribed, 0);
  const totalComplaints = sentCampaigns.reduce((s, c) => s + c.totalComplaints, 0);
  const totalContacts = bot.emailLists.reduce((s, l) => s + l._count.contacts, 0);

  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (totalClicked / totalSent) * 100 : 0;
  const bounceRate = totalSent > 0 ? (totalBounced / totalSent) * 100 : 0;
  const unsubRate = totalSent > 0 ? (totalUnsubscribed / totalSent) * 100 : 0;
  const spamRate = totalSent > 0 ? (totalComplaints / totalSent) * 100 : 0;
  const deliverabilityRate = totalSent > 0 ? ((totalSent - totalBounced) / totalSent) * 100 : 100;

  const th = EMAIL_DELIVERABILITY_THRESHOLDS;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/bots/${id}/email`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3 w-3 mr-1" />
            Email Marketing
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Email Analytics</h1>
      </div>

      <BotNav botId={bot.id} activeTab="email" />

      {/* Overview KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Mail className="h-3 w-3" />Total Emails Sent</div>
            <p className="text-2xl font-bold mt-1">{totalSent.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="h-3 w-3" />Total Contacts</div>
            <p className="text-2xl font-bold mt-1">{totalContacts.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="h-3 w-3" />Campaigns Sent</div>
            <p className="text-2xl font-bold mt-1">{sentCampaigns.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs"><BarChart3 className="h-3 w-3" />Total Campaigns</div>
            <p className="text-2xl font-bold mt-1">{campaigns.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Deliverability Health Score */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Deliverability Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totalSent === 0 ? (
            <p className="text-muted-foreground text-sm">Send your first campaign to see deliverability metrics.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MetricCard
                label="Deliverability"
                value={`${deliverabilityRate.toFixed(1)}%`}
                status={deliverabilityRate >= th.deliverabilityRate.good ? 'good' : deliverabilityRate >= th.deliverabilityRate.warning ? 'warning' : 'bad'}
                target={`> ${th.deliverabilityRate.good}%`}
              />
              <MetricCard
                label="Open Rate"
                value={`${openRate.toFixed(1)}%`}
                status={openRate >= th.openRate.good ? 'good' : openRate >= th.openRate.warning ? 'warning' : 'bad'}
                target={`${th.openRate.good}-25%`}
              />
              <MetricCard
                label="Click Rate"
                value={`${clickRate.toFixed(1)}%`}
                status={clickRate >= th.clickRate.good ? 'good' : clickRate >= th.clickRate.warning ? 'warning' : 'bad'}
                target={`${th.clickRate.good}-5%`}
              />
              <MetricCard
                label="Bounce Rate"
                value={`${bounceRate.toFixed(1)}%`}
                status={bounceRate <= th.bounceRate.warning ? 'good' : bounceRate <= th.bounceRate.bad ? 'warning' : 'bad'}
                target={`< ${th.bounceRate.bad}%`}
              />
              <MetricCard
                label="Spam Rate"
                value={`${spamRate.toFixed(3)}%`}
                status={spamRate <= th.spamRate.warning ? 'good' : spamRate <= th.spamRate.bad ? 'warning' : 'bad'}
                target={`< ${th.spamRate.bad}%`}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Campaign performance table */}
      {sentCampaigns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Campaign</th>
                    <th className="pb-2 font-medium text-right">Sent</th>
                    <th className="pb-2 font-medium text-right">Opens</th>
                    <th className="pb-2 font-medium text-right">Open %</th>
                    <th className="pb-2 font-medium text-right">Clicks</th>
                    <th className="pb-2 font-medium text-right">Click %</th>
                    <th className="pb-2 font-medium text-right">Bounces</th>
                    <th className="pb-2 font-medium text-right">Unsubs</th>
                    <th className="pb-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sentCampaigns.map((c) => {
                    const or = c.totalSent > 0 ? ((c.totalOpened / c.totalSent) * 100).toFixed(1) : '0';
                    const cr = c.totalSent > 0 ? ((c.totalClicked / c.totalSent) * 100).toFixed(1) : '0';
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            href={`/dashboard/bots/${id}/email/campaigns/${c.id}`}
                            className="text-primary hover:underline"
                          >
                            {c.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{c.subject}</p>
                        </td>
                        <td className="py-2 text-right">{c.totalSent.toLocaleString()}</td>
                        <td className="py-2 text-right">{c.totalOpened.toLocaleString()}</td>
                        <td className="py-2 text-right font-medium">{or}%</td>
                        <td className="py-2 text-right">{c.totalClicked.toLocaleString()}</td>
                        <td className="py-2 text-right font-medium">{cr}%</td>
                        <td className="py-2 text-right">{c.totalBounced}</td>
                        <td className="py-2 text-right">{c.totalUnsubscribed}</td>
                        <td className="py-2 text-muted-foreground">
                          {c.sentAt ? new Date(c.sentAt).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deliverability Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="h-4 w-4" />
            Deliverability Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <GuideSection
            icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
            title="SPF (Sender Policy Framework)"
            description="Add a TXT record to your domain DNS to authorize your email server."
            example='v=spf1 include:_spf.google.com ~all'
            tip="This tells receiving servers that Google is authorized to send email on behalf of your domain."
          />
          <GuideSection
            icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
            title="DKIM (DomainKeys Identified Mail)"
            description="A digital signature that proves emails were not modified in transit."
            example='selector._domainkey.yourdomain.com TXT "v=DKIM1; k=rsa; p=..."'
            tip="Google Workspace and Microsoft 365 can set this up for you automatically in admin settings."
          />
          <GuideSection
            icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
            title="DMARC (Domain-based Message Authentication)"
            description="Tells receiving servers what to do if SPF/DKIM fail."
            example='_dmarc.yourdomain.com TXT "v=DMARC1; p=quarantine; rua=mailto:reports@yourdomain.com"'
            tip="Start with p=none for monitoring, then move to p=quarantine after verifying everything works."
          />
          <hr className="my-4" />
          <h3 className="font-semibold text-sm">Sending Best Practices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-medium text-blue-900">Warm-up your email</p>
              <p className="text-blue-700 text-xs mt-1">
                New accounts: start with 10-20 emails/day. Increase by 10% daily.
                This builds sender reputation gradually.
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-medium text-blue-900">Avoid spam trigger words</p>
              <p className="text-blue-700 text-xs mt-1">
                Avoid: FREE, CLICK HERE, BUY NOW, !!!, ALL CAPS.
                Use natural language and provide real value.
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-medium text-blue-900">Clean your lists regularly</p>
              <p className="text-blue-700 text-xs mt-1">
                Remove hard bounces immediately. Remove subscribers who have not
                opened any email in 6+ months.
              </p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="font-medium text-blue-900">Monitor engagement</p>
              <p className="text-blue-700 text-xs mt-1">
                ISPs track open/click rates. Low engagement = more spam folder placements.
                Keep inactive contacts under 30%.
              </p>
            </div>
          </div>

          {/* Spam word checker */}
          <div className="mt-4">
            <h3 className="font-semibold text-sm mb-2">Common Spam Trigger Words to Avoid</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'FREE', 'CLICK HERE', 'BUY NOW', 'LIMITED TIME', 'ACT NOW',
                'URGENT', 'CONGRATULATIONS', 'WINNER', 'CASH', 'DISCOUNT',
                'NO OBLIGATION', 'RISK FREE', 'GUARANTEE', 'DOUBLE YOUR',
                'EARN MONEY', 'NO COST', 'ORDER NOW', 'SPECIAL PROMOTION',
              ].map((word) => (
                <span key={word} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ label, value, status, target }: {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'bad';
  target: string;
}) {
  const colors = {
    good: 'text-green-700 bg-green-50 border-green-200',
    warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    bad: 'text-red-700 bg-red-50 border-red-200',
  };
  const icons = {
    good: <CheckCircle2 className="h-4 w-4" />,
    warning: <AlertCircle className="h-4 w-4" />,
    bad: <AlertTriangle className="h-4 w-4" />,
  };

  return (
    <div className={`rounded-lg p-3 border ${colors[status]}`}>
      <div className="flex items-center gap-1 text-xs font-medium opacity-75">
        {icons[status]}
        {label}
      </div>
      <p className="text-xl font-bold mt-1">{value}</p>
      <p className="text-xs opacity-60">Target: {target}</p>
    </div>
  );
}

function GuideSection({ icon, title, description, example, tip }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  example: string;
  tip: string;
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="bg-gray-100 rounded p-2 mt-2 font-mono text-xs overflow-x-auto">
        {example}
      </div>
      <p className="text-xs text-muted-foreground mt-2 italic">{tip}</p>
    </div>
  );
}
