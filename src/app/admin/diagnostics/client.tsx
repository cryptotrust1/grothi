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
              <h2 className="text-lg font-semibold mb-4">Token Analysis</h2>
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
                  <div className={`p-3 rounded text-sm font-medium ${result.publishPermission ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    {result.publishPermission
                      ? 'instagram_business_content_publish scope IS present on token'
                      : 'CRITICAL: instagram_business_content_publish scope is MISSING from token! Publishing will fail.'}
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
              <h2 className="text-lg font-semibold mb-4">Test Container Creation (Publishing Test)</h2>
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
