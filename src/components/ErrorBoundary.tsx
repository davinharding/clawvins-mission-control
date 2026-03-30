import * as React from 'react';
import { Button } from '@/components/ui/button';

type Props = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught render error:', error, errorInfo);
  }

  private handleTryAgain = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReload = () => {
    window.location.reload();
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="default" onClick={this.handleTryAgain}>
                Try Again
              </Button>
              <Button type="button" variant="outline" onClick={this.handleReload}>
                Reload
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
