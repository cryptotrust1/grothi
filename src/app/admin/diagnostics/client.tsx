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
  failedPostAnalysis?: Array<{
    postId: string;
    content: string;
    error: string | null;
    createdAt: string;
    postType: string | null;
    hasMedia: boolean;
    mediaDetails: { id: string; filePath: string; type: string; mimeType: string; filename: string } | null;
    resolvedUrl: string | null;
    fileExistsOnDisk: boolean | null;
    urlAccessible: boolean | null;
    urlContentType: string | null;
    effectivePostType: string | null;
  }>;
  realMediaTest?: {
    mediaId: string;
    filename: string;
    filePath: string;
    mimeType: string;
    resolvedUrl: string;
    fileExistsOnDisk: boolean;
    urlAccessible: boolean;
    urlContentType: string | null;
    containerSuccess: boolean;
    containerError: string | null;
    rawResponse: unknown;
  } | null;
  mediaInventory?: {
    total: number;
    byMimeType: Record<string, number>;
    instagramUnsupported: Array<{ id: string; filename: string; mimeType: string }>;
  };
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

          {/* Real Media Container Test */}
          {result.realMediaTest && (
            <Card className={result.realMediaTest.containerSuccess ? 'border-green-500' : 'border-red-500'}>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Real Media Container Test (Your Actual Media)</h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Tests container creation with your actual media files, not a Wikimedia test image.
                  If Wikimedia passes but this fails, the issue is with your media format or URL serving.
                </p>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-medium">File:</span> {result.realMediaTest.filename}</div>
                    <div><span className="font-medium">MIME Type:</span> <code className="bg-muted px-1 rounded text-xs">{result.realMediaTest.mimeType}</code></div>
                    <div><span className="font-medium">Path:</span> <code className="bg-muted px-1 rounded text-xs">{result.realMediaTest.filePath}</code></div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">File on Disk:</span>
                      <Badge variant={result.realMediaTest.fileExistsOnDisk ? 'success' : 'destructive'}>
                        {result.realMediaTest.fileExistsOnDisk ? 'EXISTS' : 'MISSING'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">Resolved URL:</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded ml-1 break-all block mt-1">{result.realMediaTest.resolvedUrl}</code>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">URL Accessible:</span>
                      <Badge variant={result.realMediaTest.urlAccessible ? 'success' : 'destructive'}>
                        {result.realMediaTest.urlAccessible ? 'YES' : 'NO'}
                      </Badge>
                    </div>
                    {result.realMediaTest.urlContentType && (
                      <div>
                        <span className="font-medium">Content-Type:</span>{' '}
                        <code className="bg-muted px-1 rounded text-xs">{result.realMediaTest.urlContentType}</code>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Container Creation:</span>
                    <Badge variant={result.realMediaTest.containerSuccess ? 'success' : 'destructive'}>
                      {result.realMediaTest.containerSuccess ? 'SUCCESS' : 'FAILED'}
                    </Badge>
                  </div>
                  {result.realMediaTest.containerError && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded font-mono">{result.realMediaTest.containerError}</div>
                  )}
                  {result.realMediaTest.rawResponse != null && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Raw API Response</summary>
                      <pre className="bg-muted p-3 rounded mt-1 overflow-auto max-h-48">
                        {JSON.stringify(result.realMediaTest.rawResponse, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Media Library Inventory */}
          {result.mediaInventory && result.mediaInventory.total > 0 && (
            <Card className={result.mediaInventory.instagramUnsupported.length > 0 ? 'border-amber-500' : ''}>
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">Media Library Inventory ({result.mediaInventory.total} files)</h2>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="font-medium">Format Breakdown:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(result.mediaInventory.byMimeType).map(([mime, count]) => {
                        const isSupported = ['image/jpeg', 'image/png', 'video/mp4'].includes(mime.toLowerCase());
                        return (
                          <Badge key={mime} variant={isSupported ? 'secondary' : 'destructive'} className="text-xs">
                            {mime}: {count}{!isSupported && ' (unsupported)'}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                  {result.mediaInventory.instagramUnsupported.length > 0 && (
                    <div className="bg-amber-50 p-3 rounded">
                      <p className="font-medium text-amber-900 mb-2">
                        {result.mediaInventory.instagramUnsupported.length} file(s) in unsupported formats:
                      </p>
                      <div className="space-y-1">
                        {result.mediaInventory.instagramUnsupported.map((m) => (
                          <div key={m.id} className="text-xs text-amber-800 font-mono">
                            {m.filename} — {m.mimeType}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-amber-700 mt-2">
                        Instagram accepts: JPEG, PNG (images) and MP4 (video) only.
                      </p>
                    </div>
                  )}
                  {result.mediaInventory.instagramUnsupported.length === 0 && (
                    <div className="bg-green-50 p-3 rounded text-green-800 text-sm">
                      All media files are in Instagram-compatible formats.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Failed Post Deep Analysis */}
          {result.failedPostAnalysis && result.failedPostAnalysis.length > 0 && (
            <Card className="border-red-500">
              <CardContent className="pt-6">
                <h2 className="text-lg font-semibold mb-4">
                  Failed Post Deep Analysis ({result.failedPostAnalysis.length})
                </h2>
                <p className="text-xs text-muted-foreground mb-4">
                  Shows exactly what media was attached, what URL was sent to Instagram, and why it failed.
                </p>
                <div className="space-y-4">
                  {result.failedPostAnalysis.map((post) => (
                    <div key={post.postId} className="bg-red-50 p-4 rounded text-sm space-y-2 border border-red-200">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">{new Date(post.createdAt).toLocaleString()}</span>
                        {post.effectivePostType && <Badge variant="secondary" className="text-[10px]">{post.effectivePostType}</Badge>}
                        <Badge variant={post.hasMedia ? 'secondary' : 'destructive'} className="text-[10px]">
                          {post.hasMedia ? 'Has Media' : 'NO MEDIA'}
                        </Badge>
                      </div>

                      {/* Content */}
                      <p className="font-medium text-red-900">{post.content}</p>

                      {/* Error */}
                      <p className="text-red-700 font-mono text-xs break-all bg-red-100 p-2 rounded">
                        {post.error || 'No error message stored'}
                      </p>

                      {/* Media Details */}
                      {post.mediaDetails ? (
                        <div className="bg-white/50 p-3 rounded space-y-1 text-xs">
                          <div className="font-medium text-red-900 mb-1">Media Details:</div>
                          <div className="grid grid-cols-2 gap-1">
                            <div><span className="font-medium">Filename:</span> {post.mediaDetails.filename}</div>
                            <div>
                              <span className="font-medium">MIME Type:</span>{' '}
                              <code className={`px-1 rounded ${
                                ['image/jpeg', 'image/png'].includes(post.mediaDetails.mimeType.toLowerCase())
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800 font-bold'
                              }`}>{post.mediaDetails.mimeType}</code>
                            </div>
                            <div><span className="font-medium">Type:</span> {post.mediaDetails.type}</div>
                            <div><span className="font-medium">Path:</span> <code className="bg-muted px-1 rounded">{post.mediaDetails.filePath}</code></div>
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="flex items-center gap-1">
                              <span className="font-medium">On Disk:</span>
                              <Badge variant={post.fileExistsOnDisk ? 'success' : 'destructive'} className="text-[10px]">
                                {post.fileExistsOnDisk === null ? 'N/A' : post.fileExistsOnDisk ? 'YES' : 'MISSING'}
                              </Badge>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="font-medium">URL OK:</span>
                              <Badge variant={post.urlAccessible ? 'success' : 'destructive'} className="text-[10px]">
                                {post.urlAccessible === null ? 'N/A' : post.urlAccessible ? 'YES' : 'NO'}
                              </Badge>
                            </span>
                            {post.urlContentType && (
                              <span>
                                <span className="font-medium">Served as:</span>{' '}
                                <code className="bg-muted px-1 rounded">{post.urlContentType}</code>
                              </span>
                            )}
                          </div>
                          {post.resolvedUrl && (
                            <div className="mt-1">
                              <span className="font-medium">URL sent to Instagram:</span>
                              <code className="bg-muted px-1 rounded block mt-0.5 break-all">{post.resolvedUrl}</code>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-red-100 p-2 rounded text-xs text-red-800 font-medium">
                          No media attached to this post. Instagram requires an image or video!
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legacy: Recent Failed Posts (basic view) */}
          {(!result.failedPostAnalysis || result.failedPostAnalysis.length === 0) &&
           result.recentFailedPosts && result.recentFailedPosts.length > 0 && (
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
