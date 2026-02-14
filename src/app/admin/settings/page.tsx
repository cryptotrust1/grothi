import { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth';
import { getSystemSetting } from '@/lib/video-provider';
import { maskApiKey } from '@/lib/encryption';
import { AdminSettingsClient } from './client';

export const metadata: Metadata = { title: 'Admin Settings', robots: { index: false } };

export default async function AdminSettingsPage() {
  await requireAdmin();

  const [videoProvider, replicateKey, runwayKey] = await Promise.all([
    getSystemSetting('video_provider'),
    getSystemSetting('replicate_api_token'),
    getSystemSetting('runway_api_secret'),
  ]);

  const replicateEnv = process.env.REPLICATE_API_TOKEN;
  const runwayEnv = process.env.RUNWAYML_API_SECRET;

  return (
    <AdminSettingsClient
      initialProvider={(videoProvider as 'replicate' | 'runway') || 'replicate'}
      replicateKeyPreview={replicateKey ? maskApiKey(replicateKey) : (replicateEnv ? maskApiKey(replicateEnv) + ' (env)' : null)}
      runwayKeyPreview={runwayKey ? maskApiKey(runwayKey) : (runwayEnv ? maskApiKey(runwayEnv) + ' (env)' : null)}
      replicateConfigured={!!(replicateKey || replicateEnv)}
      runwayConfigured={!!(runwayKey || runwayEnv)}
    />
  );
}
