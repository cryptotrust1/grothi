'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BotOption {
  id: string;
  name: string;
  brandName: string;
  userEmail: string;
  igStatus: string;
  igUsername: string;
  igUpdatedAt: string;
}

interface DiagResult {
  connection: { status: string; config: unknown } | null;
  tokenDebug: {
    isValid: boolean;
    appId?: string;
    userId?: string;
    type?: string;
    scopes?: string[];
    expiresAt?: string;
    error?: string;
  } | null;
  accountInfo: { id: string; username?: string } | null;
  publishPermission: boolean;
  testContainerResult: {
    success: boolean;
    error?: string;
    httpStatus?: number;
    rawResponse?: unknown;
  } | null;
  containerStatusResult: {
    status: string;
    error?: string;
  } | null;
  publishTestResult: {
    success: boolean;
    mediaId?: string;
    deleted?: boolean;
    error?: string;
  } | null;
  mediaUrlTest: {
    configured: boolean;
    baseUrl?: string;
    testUrl?: string;
    accessible?: boolean;
    error?: string;
    contentType?: string;
  } | null;
  recentFailedPosts: {
    id: string;
    content: string;
    error: string | null;
    createdAt: string;
    postType: string | null;
  }[];
  recommendations: string[];
  error?: string;
}

export function DiagnosticsClient({ bots }: { bots: BotOption[] }) {
  const [selectedBot, setSelectedBot] = useState<string>(bots[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDiag() {
    if (!selectedBot) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/admin/instagram-diagnostics?botId=${encodeURIComponent(selectedBot)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  const selectedBotInfo = bots.find((b) => b.id === selectedBot);

  return (
    <div className="space-y-6">
      {/* Bot selector */}
      <Card>
        <CardContent className="pt-6">
          <label className="block text-sm font-medium mb-2">Select Bot with Instagram Connection</label>
          {bots.length === 0 ? (
            <p className="text-muted-foreground">No bots with Instagram connections found.</p>
          ) : (
            <div className="flex gap-3 items-end flex-wrap">
              <select
                value={selectedBot}
                onChange={(e) => { setSelectedBot(e.target.value); setResult(null); setError(null); }}
                className="border rounded-md px-3 py-2 text-sm bg-background min-w-[300px]"
              >
                {bots.map((bot) => (
                  <option key={bot.id} value={bot.id}>
                    {bot.name} (@{bot.igUsername}) - {bot.userEmail}
                  </option>
                ))}
              </select>
              <Button onClick={runDiag} disabled={loading || !selectedBot}>
                {loading ? 'Running diagnostics...' : 'Run Diagnostics'}
              </Button>
            </div>
          )}
          {selectedBotInfo && (
            <div className="mt-3 text-sm text-muted-foreground">
              IG Status: <Badge variant={selectedBotInfo.igStatus === 'CONNECTED' ? 'success' : 'destructive'}>{selectedBotInfo.igStatus}</Badge>
              {selectedBotInfo.igUpdatedAt && <span className="ml-3">Last updated: {new Date(selectedBotInfo.igUpdatedAt).toLocaleString()}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <p className="text-red-600 font-medium">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <>
          {/* Token Debug */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Token Analysis (via Instagram /me endpoint)</h2>
              {result.tokenDebug ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Token Valid:</span>
                    <Badge variant={result.tokenDebug.isValid ? 'success' : 'destructive'}>
                      {result.tokenDebug.isValid ? 'YES' : 'NO'}
                    </Badge>
                  </div>
                  {result.tokenDebug.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{result.tokenDebug.error}</div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="font-medium">App ID:</span> {result.tokenDebug.appId || 'N/A'}</div>
                    <div><span className="font-medium">User ID:</span> {result.tokenDebug.userId || 'N/A'}</div>
                    <div><span className="font-medium">Type:</span> {result.tokenDebug.type || 'N/A'}</div>
                    <div><span className="font-medium">Expires:</span> {result.tokenDebug.expiresAt ? new Date(result.tokenDebug.expiresAt).toLocaleString() : 'N/A'}</div>
                  </div>
                  <div>
                    <span className="font-medium text-sm">Scopes on Token:</span>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {result.tokenDebug.scopes && result.tokenDebug.scopes.length > 0 ? (
                        result.tokenDebug.scopes.map((scope) => (
                          <Badge
                            key={scope}
                            variant={
                              scope.includes('content_publish') || scope.includes('business_content_publish')
                                ? 'success'
                                : 'secondary'
                            }
                          >
                            {scope}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="destructive">NO SCOPES FOUND</Badge>
                      )}
                    </div>
                  </div>
                  {/* Highlight the critical check */}
                  <div className={`p-3 rounded text-sm font-medium ${result.publishPermission ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                    {result.publishPermission
                      ? 'instagram_business_content_publish CONFIRMED working (container creation succeeded)'
                      : 'instagram_business_content_publish not yet confirmed. See container test below for details.'}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No token debug info available.</p>
              )}
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Account Info</h2>
              {result.accountInfo ? (
                <div className="text-sm space-y-1">
                  <div><span className="font-medium">Account ID:</span> {result.accountInfo.id}</div>
                  <div><span className="font-medium">Username:</span> @{result.accountInfo.username || 'unknown'}</div>
                  <Badge variant="success">Account accessible</Badge>
                </div>
              ) : (
                <Badge variant="destructive">Cannot read account info - token may be invalid</Badge>
              )}
            </CardContent>
          </Card>

          {/* Test Container */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Step 1/3: Container Creation (with Wikimedia test image)</h2>
              {result.testContainerResult ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Result:</span>
                    <Badge variant={result.testContainerResult.success ? 'success' : 'destructive'}>
                      {result.testContainerResult.success ? 'SUCCESS - Publishing works!' : 'FAILED'}
                    </Badge>
                    {result.testContainerResult.httpStatus && (
                      <span className="text-sm text-muted-foreground">HTTP {result.testContainerResult.httpStatus}</span>
                    )}
                  </div>
                  {result.testContainerResult.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{result.testContainerResult.error}</div>
                  )}
                  {result.testContainerResult.rawResponse != null && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Raw API Response</summary>
                      <pre className="bg-muted p-3 rounded mt-1 overflow-auto max-h-48">
                        {JSON.stringify(result.testContainerResult.rawResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Test not run.</p>
              )}
            </CardContent>
          </Card>

          {/* Container Status (Step 2 of 3) */}
          {result.containerStatusResult && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Step 2/3: Container Status Polling</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <Badge variant={result.containerStatusResult.status === 'FINISHED' ? 'success' : 'destructive'}>
                      {result.containerStatusResult.status}
                    </Badge>
                  </div>
                  {result.containerStatusResult.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{result.containerStatusResult.error}</div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    After container creation, Instagram processes the image. It must reach FINISHED before it can be published.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Full Publish Test (Step 3 of 3) */}
          {result.publishTestResult && (
            <Card className={result.publishTestResult.success ? 'border-green-500' : 'border-red-500'}>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Step 3/3: Actual media_publish Test</h2>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Result:</span>
                    <Badge variant={result.publishTestResult.success ? 'success' : 'destructive'}>
                      {result.publishTestResult.success ? 'PUBLISH SUCCESS' : 'PUBLISH FAILED'}
                    </Badge>
                  </div>
                  {result.publishTestResult.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded font-mono">{result.publishTestResult.error}</div>
                  )}
                  {result.publishTestResult.mediaId && (
                    <p className="text-sm text-green-700">Published post ID: {result.publishTestResult.mediaId}</p>
                  )}
                  {result.publishTestResult.deleted === true && (
                    <p className="text-sm text-green-700">Test post was auto-deleted.</p>
                  )}
                  {result.publishTestResult.deleted === false && (
                    <p className="text-sm text-amber-700">Test post could NOT be auto-deleted. Please delete it manually from Instagram.</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This is the ACTUAL publish step. If this fails, the error here is exactly why your real posts fail.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Media URL Accessibility */}
          {result.mediaUrlTest && (
            <Card className={result.mediaUrlTest.accessible === false ? 'border-red-500' : ''}>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Media URL Accessibility (Real Media Test)</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">MEDIA_DIRECT_BASE:</span>
                    <Badge variant={result.mediaUrlTest.configured ? 'success' : 'destructive'}>
                      {result.mediaUrlTest.configured ? 'CONFIGURED' : 'NOT SET'}
                    </Badge>
                    {result.mediaUrlTest.baseUrl && (
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">{result.mediaUrlTest.baseUrl}</code>
                    )}
                  </div>
                  {result.mediaUrlTest.testUrl && (
                    <div>
                      <span className="font-medium">Test URL:</span>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded ml-1 break-all">{result.mediaUrlTest.testUrl}</code>
                    </div>
                  )}
                  {result.mediaUrlTest.accessible != null && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Accessible by Meta crawlers:</span>
                      <Badge variant={result.mediaUrlTest.accessible ? 'success' : 'destructive'}>
                        {result.mediaUrlTest.accessible ? 'YES' : 'NO'}
                      </Badge>
                    </div>
                  )}
                  {result.mediaUrlTest.error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded">{result.mediaUrlTest.error}</div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Instagram downloads media from this URL when creating posts. If blocked (Cloudflare, Nginx), posts fail.
                    {!result.mediaUrlTest.configured && (
                      <span className="text-red-600 font-medium"> Without MEDIA_DIRECT_BASE, URLs go through Cloudflare which blocks Meta crawlers!</span>
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Failed Posts */}
          {result.recentFailedPosts && result.recentFailedPosts.length > 0 && (
            <Card className="border-red-500">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Recent Failed Instagram Posts ({result.recentFailedPosts.length})</h2>
                <div className="space-y-3">
                  {result.recentFailedPosts.map((post) => (
                    <div key={post.id} className="bg-red-50 p-3 rounded text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleString()}</span>
                        {post.postType && <Badge variant="secondary" className="text-[10px]">{post.postType}</Badge>}
                      </div>
                      <p className="font-medium text-red-900 truncate">{post.content}</p>
                      <p className="text-red-700 font-mono text-xs break-all">
                        {post.error || 'No error message stored'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <Card className="border-yellow-500">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Recommendations</h2>
                <ul className="space-y-3">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm bg-yellow-50 p-3 rounded text-yellow-900">
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Connection Raw Info */}
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4">Connection Details</h2>
              {result.connection ? (
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Status:</span> {result.connection.status}</div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">Raw Config</summary>
                    <pre className="bg-muted p-3 rounded mt-1 overflow-auto max-h-48">
                      {JSON.stringify(result.connection.config, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <p className="text-muted-foreground">No connection found.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
