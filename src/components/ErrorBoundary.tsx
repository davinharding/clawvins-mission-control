import * as React from 'react';
import { Button } from '@/components/ui/button';
import { recoverMissionControlApp } from '@/lib/browserRecovery';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
  recoveryError: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    componentStack: '',
    recoveryError: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: '', recoveryError: '' };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
    const report = {
      message: error.message,
      stack: error.stack || '',
      componentStack: errorInfo.componentStack || '',
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
    this.setState({ componentStack: report.componentStack });
    try {
      sessionStorage.setItem('mission-control:last-crash', JSON.stringify(report));
    } catch {
      // Diagnostics are best effort; private browsing may reject storage writes.
    }
    window.dispatchEvent(new CustomEvent('mission-control:error', { detail: report }));
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: null, componentStack: '', recoveryError: '' });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleRecover = async () => {
    try {
      await recoverMissionControlApp();
      window.location.reload();
    } catch (error) {
      this.setState({ recoveryError: error instanceof Error ? error.message : String(error) });
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[240px] items-center justify-center p-6">
          <div className="w-full max-w-xl rounded-xl border border-border/60 bg-card p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Something went wrong
            </p>
            <h3 className="mt-2 text-lg font-semibold">This panel crashed, but the app is still running.</h3>
            <p className="mt-2 break-words text-sm text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <details className="mt-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">Technical details</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3">
                {[this.state.error?.stack, this.state.componentStack].filter(Boolean).join('\n\n')}
              </pre>
            </details>
            {this.state.recoveryError && (
              <p role="alert" className="mt-3 break-words text-sm text-destructive">
                Recovery failed: {this.state.recoveryError}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="default" onClick={this.handleTryAgain}>
                Try Again
              </Button>
              <Button type="button" variant="outline" onClick={this.handleReload}>
                Reload
              </Button>
              <Button type="button" variant="outline" onClick={this.handleRecover}>
                Recover App Files
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
