'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

interface ArmData {
  name: string;
  reward: number;
  pulls: number;
  confidence: number;
}

const BAR_COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#818cf8', '#7c3aed', '#5b21b6', '#4c1d95',
  '#4f46e5', '#4338ca', '#3730a3', '#312e81',
  '#6d28d9', '#7e22ce', '#9333ea', '#a855f7',
  '#b47bff', '#c084fc', '#d8b4fe', '#e9d5ff',
  '#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa',
];

export function ArmDistributionChart({ data, label }: { data: ArmData[]; label: string }) {
  if (data.length === 0) {
    return <p className="text-center py-8 text-sm text-muted-foreground">No data yet for {label}.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 32)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
        <XAxis type="number" className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis
          dataKey="name"
          type="category"
          className="text-xs"
          tick={{ fontSize: 11 }}
          width={75}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'reward') return [value.toFixed(2), 'Avg Reward'];
            return [value, name];
          }}
        />
        <Bar dataKey="reward" name="reward" radius={[0, 4, 4, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface EngagementTrendData {
  date: string;
  score: number;
  posts: number;
}

export function EngagementScoreTrend({ data }: { data: EngagementTrendData[] }) {
  if (data.length === 0) {
    return <p className="text-center py-8 text-sm text-muted-foreground">No engagement data yet.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 11 }} />
        <YAxis className="text-xs" tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number, name: string) => {
            if (name === 'Avg Score') return [value.toFixed(2), name];
            return [value, name];
          }}
        />
        <Area
          type="monotone"
          dataKey="score"
          stroke="#6366f1"
          fill="url(#colorScore)"
          strokeWidth={2}
          name="Avg Score"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
