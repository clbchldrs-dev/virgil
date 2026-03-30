'use client';

import { useEffect, useState } from 'react';

/**
 * Client-side startup check component.
 * Runs health check on first load, displays warnings if needed.
 * Non-blocking: degraded state (missing optional APIs) still renders.
 */
export function StartupCheck() {
  const [status, setStatus] = useState<'pending' | 'healthy' | 'degraded' | 'error'>('pending');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();

        setStatus(data.status);
        setErrors(data.errors || []);

        // Log health check for debugging
        if (data.status !== 'healthy') {
          console.warn('[Virgil] Startup check:', data);
        }
      } catch (error) {
        console.error('[Virgil] Health check failed:', error);
        setStatus('error');
        setErrors(['Could not reach health check endpoint']);
      }
    };

    checkHealth();
  }, []);

  // Don't render UI for degraded/error in this PoC
  // In production, you might show a banner or toast
  if (status === 'healthy' || status === 'pending') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-50 border border-yellow-200 rounded p-4 max-w-sm">
      <h3 className="font-semibold text-yellow-900 mb-2">
        {status === 'error' ? '⚠️ Startup Check Failed' : '⚠️ Startup Check: Degraded'}
      </h3>
      <ul className="text-sm text-yellow-800 space-y-1">
        {errors.map((error, i) => (
          <li key={i}>• {error}</li>
        ))}
      </ul>
      <p className="text-xs text-yellow-700 mt-3">
        Check <code className="bg-yellow-100 px-1">/api/health</code> for details.
      </p>
    </div>
  );
}
