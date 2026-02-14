import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getSystemSetting, setSystemSetting } from '@/lib/video-provider';
import { maskApiKey } from '@/lib/encryption';

// GET /api/admin/settings — Get current provider settings
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [videoProvider, replicateKey, runwayKey] = await Promise.all([
    getSystemSetting('video_provider'),
    getSystemSetting('replicate_api_token'),
    getSystemSetting('runway_api_secret'),
  ]);

  return NextResponse.json({
    videoProvider: videoProvider || 'replicate',
    replicateConfigured: !!(replicateKey || process.env.REPLICATE_API_TOKEN),
    runwayConfigured: !!(runwayKey || process.env.RUNWAYML_API_SECRET),
    replicateKeyPreview: replicateKey ? maskApiKey(replicateKey) : (process.env.REPLICATE_API_TOKEN ? maskApiKey(process.env.REPLICATE_API_TOKEN) + ' (env)' : null),
    runwayKeyPreview: runwayKey ? maskApiKey(runwayKey) : (process.env.RUNWAYML_API_SECRET ? maskApiKey(process.env.RUNWAYML_API_SECRET) + ' (env)' : null),
  });
}

// POST /api/admin/settings — Update provider settings
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { action } = body;

  if (action === 'set_provider') {
    const { provider } = body;
    if (provider !== 'replicate' && provider !== 'runway') {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
    await setSystemSetting('video_provider', provider);
    return NextResponse.json({ success: true, provider });
  }

  if (action === 'set_replicate_key') {
    const { apiKey } = body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 5) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }
    await setSystemSetting('replicate_api_token', apiKey.trim());
    return NextResponse.json({ success: true, preview: maskApiKey(apiKey.trim()) });
  }

  if (action === 'set_runway_key') {
    const { apiKey } = body;
    if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 5) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 400 });
    }
    await setSystemSetting('runway_api_secret', apiKey.trim());
    return NextResponse.json({ success: true, preview: maskApiKey(apiKey.trim()) });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
