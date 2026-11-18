import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { isChunkLoadError, reloadForNewVersion } from '@/lib/chunkReload';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
    // A new version was deployed while this tab was open: load it instead of showing an error.
    if (isChunkLoadError(error)) reloadForNewVersion();
  }

  componentDidMount() {
    // Catch unhandled promise rejections (e.g. from upload failures) so the
    // page doesn't go blank or hang silently.
    window.addEventListener('unhandledrejection', this.handleRejection);
    window.addEventListener('error', this.handleWindowError);
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleRejection);
    window.removeEventListener('error', this.handleWindowError);
  }

  handleRejection = (event: PromiseRejectionEvent) => {
    // Stale page files after a deployment are handled by the global reload handler
    if (isChunkLoadError(event.reason)) return;
    console.error('Unhandled promise rejection:', event.reason);
    const message =
      event.reason?.message ||
      (typeof event.reason === 'string' ? event.reason : 'Something went wrong. Please try again.');
    toast.error(message);
    // Prevent the rejection from blanking the app
    event.preventDefault();
  };

  handleWindowError = (event: ErrorEvent) => {
    // Resource load errors etc. — log but don't blank
    console.error('Window error:', event.error || event.message);
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && isChunkLoadError(this.state.error)) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Updating to the latest version…</h1>
            <p className="text-sm text-muted-foreground">
              A new version of Niza Cloud is available. If this page doesn’t refresh on its own, click Reload.
            </p>
            <div className="flex justify-center pt-2">
              <Button onClick={this.handleReload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <div className="flex gap-2 justify-center pt-2">
              <Button variant="outline" onClick={this.handleReset}>
                Try again
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
