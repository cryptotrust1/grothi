'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0, backgroundColor: '#fafafa' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '480px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: '1.5rem' }}>
            A new version may have been deployed. Please reload the page.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '0.5rem 1.5rem', backgroundColor: '#18181b', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Reload Page
            </button>
            <button
              onClick={reset}
              style={{ padding: '0.5rem 1.5rem', backgroundColor: '#fff', color: '#18181b', border: '1px solid #e4e4e7', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
