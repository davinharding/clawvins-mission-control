import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { recoverMissionControlApp } from '@/lib/browserRecovery';

vi.mock('@/lib/browserRecovery', () => ({
  recoverMissionControlApp: vi.fn(),
}));

function createBoundary(): ErrorBoundary {
  const boundary = new ErrorBoundary({ children: <div>healthy</div> });
  boundary.setState = ((update: React.SetStateAction<typeof boundary.state>) => {
    const nextState = typeof update === 'function'
      ? update(boundary.state)
      : update;
    boundary.state = { ...boundary.state, ...nextState };
  }) as typeof boundary.setState;
  return boundary;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renders a recovery UI and records render diagnostics', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onTelemetry = vi.fn();
    window.addEventListener('mission-control:error', onTelemetry);
    const boundary = createBoundary();
    const error = new Error('render exploded');
    boundary.state = ErrorBoundary.getDerivedStateFromError(error);

    try {
      boundary.componentDidCatch(error, {
        componentStack: '\n    at BrokenPanel',
      } as React.ErrorInfo);
      const markup = renderToStaticMarkup(boundary.render() as React.ReactElement);

      expect(markup).toContain('Something went wrong');
      expect(markup).toContain('render exploded');
      expect(markup).toContain('Recover App Files');
      expect(JSON.parse(sessionStorage.getItem('mission-control:last-crash') || '{}')).toMatchObject({
        message: 'render exploded',
        componentStack: '\n    at BrokenPanel',
      });
      expect(onTelemetry).toHaveBeenCalledOnce();
    } finally {
      window.removeEventListener('mission-control:error', onTelemetry);
    }
  });

  it('shows a useful error if scoped recovery fails', async () => {
    vi.mocked(recoverMissionControlApp).mockRejectedValueOnce(new Error('cache access denied'));
    const boundary = createBoundary();
    boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('render exploded'));

    await (boundary as unknown as { handleRecover: () => Promise<void> }).handleRecover();

    expect(renderToStaticMarkup(boundary.render() as React.ReactElement))
      .toContain('Recovery failed: cache access denied');
  });
});
