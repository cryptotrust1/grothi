'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Shield, ShieldCheck, ShieldOff, Copy, CheckCircle } from 'lucide-react';

type Step = 'idle' | 'qr' | 'recovery' | 'disable';

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState<Step>('idle');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [is2FAEnabled, setIs2FAEnabled] = useState(enabled);
  const [copied, setCopied] = useState(false);

  // Step 1: Start setup — get QR code
  const startSetup = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to start 2FA setup');
        return;
      }
      const data = await res.json();
      setQrCodeDataUrl(data.qrCodeDataUrl);
      setSecretKey(data.secret);
      setStep('qr');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Step 2: Verify code to confirm setup
  const confirmSetup = useCallback(async () => {
    if (!/^\d{6}$/.test(verifyCode)) {
      setError('Enter a 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/verify-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Verification failed');
        return;
      }
      const data = await res.json();
      setRecoveryCodes(data.recoveryCodes);
      setIs2FAEnabled(true);
      setStep('recovery');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [verifyCode]);

  // Disable 2FA
  const handleDisable = useCallback(async () => {
    if (!/^\d{6}$/.test(disableCode)) {
      setError('Enter a 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: disableCode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to disable 2FA');
        return;
      }
      setIs2FAEnabled(false);
      setStep('idle');
      setDisableCode('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [disableCode]);

  const copyRecoveryCodes = useCallback(() => {
    navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [recoveryCodes]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {is2FAEnabled ? (
            <ShieldCheck className="h-5 w-5 text-green-600" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          <CardTitle>Two-Factor Authentication</CardTitle>
        </div>
        <CardDescription>
          {is2FAEnabled
            ? '2FA is enabled. Your account is protected with Google Authenticator.'
            : 'Add an extra layer of security with Google Authenticator.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Idle state — show enable or disable button */}
        {step === 'idle' && !is2FAEnabled && (
          <Button onClick={startSetup} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            Enable 2FA
          </Button>
        )}

        {step === 'idle' && is2FAEnabled && (
          <Button variant="outline" onClick={() => setStep('disable')} className="gap-2">
            <ShieldOff className="h-4 w-4" />
            Disable 2FA
          </Button>
        )}

        {/* QR code step */}
        {step === 'qr' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Scan this QR code with Google Authenticator:
            </div>
            {qrCodeDataUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCodeDataUrl} alt="2FA QR Code" width={256} height={256} className="rounded-lg border" />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Manual entry key:</Label>
              <code className="block text-xs bg-muted p-2 rounded break-all select-all">{secretKey}</code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="verify-code">Enter code from app to verify:</Label>
              <Input
                id="verify-code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="text-center text-lg tracking-widest"
                maxLength={6}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={confirmSetup} disabled={loading || verifyCode.length !== 6} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
              </Button>
              <Button variant="outline" onClick={() => { setStep('idle'); setError(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Recovery codes step */}
        {step === 'recovery' && (
          <div className="space-y-4">
            <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              <strong>Save these recovery codes!</strong> Each can be used once if you lose access to your authenticator app. This is the only time they will be shown.
            </div>
            <div className="grid grid-cols-2 gap-2 bg-muted p-4 rounded-lg font-mono text-sm">
              {recoveryCodes.map((code, i) => (
                <div key={i} className="text-center">{code}</div>
              ))}
            </div>
            <Button variant="outline" onClick={copyRecoveryCodes} className="w-full gap-2">
              {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Recovery Codes'}
            </Button>
            <Button onClick={() => { setStep('idle'); setRecoveryCodes([]); }} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Disable step */}
        {step === 'disable' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Enter your current authenticator code to disable 2FA:
            </div>
            <Input
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="text-center text-lg tracking-widest"
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="destructive" onClick={handleDisable} disabled={loading || disableCode.length !== 6} className="flex-1">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Disable 2FA'}
              </Button>
              <Button variant="outline" onClick={() => { setStep('idle'); setError(''); setDisableCode(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
