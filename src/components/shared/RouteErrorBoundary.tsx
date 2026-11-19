import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { isChunkLoadError, reloadForNewVersion } from '@/lib/chunkReload';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a crash in ONE page so the sidebar, header and the rest of the app keep working.
 * Render it with `key={pathname}` so moving to another page clears the error.
 * (The app-wide ErrorBoundary still handles unhandled promise rejections.)
 */
export default class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info);
    if (isChunkLoadError(error)) reloadForNewVersion();
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <h2 className="text-lg font-semibold">This page hit a problem</h2>
          <p className="text-sm text-muted-foreground max-w-md mt-1">
            The rest of the app still works. Try again, or open another page from the menu.
          </p>
          <p className="text-xs text-muted-foreground mt-2 break-words max-w-md">{this.state.error.message}</p>
        </div>
        <Button onClick={() => this.setState({ error: null })} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Try again
        </Button>
      </div>
    );
  }
}
