import { formatTrace } from '@/lib/errorTrace';

interface Props {
  error: Error | { message: string; stack?: string };
  onRetry?: () => void;
  onReport?: () => void;
}

/**
 * Terminal-style crash screen. Renders the real Error via errorTrace and
 * exposes Retry + Report-to-clipboard actions. Meant to live inside the
 * app's ErrorBoundary.
 */
export function TerminalError({ error, onRetry, onReport }: Props) {
  const trace = formatTrace(error);

  async function copy() {
    try {
      await navigator.clipboard.writeText([trace.title, ...trace.lines].join('\n'));
    } catch {
      // clipboard may not be available (insecure origin); silently swallow.
    }
    onReport?.();
  }

  return (
    <div
      role="alertdialog"
      aria-labelledby="err-title"
      className="flex-1 flex flex-col items-stretch p-4 bg-bg"
      data-testid="terminal-error"
    >
      <h1
        id="err-title"
        className="font-mono text-mono12 text-danger tracking-widest uppercase mb-2"
      >
        PANIC · {trace.title}
      </h1>
      <pre className="font-mono text-mono10 text-text bg-surface border border-border rounded-xs p-3 overflow-auto whitespace-pre-wrap">
        {trace.lines.join('\n')}
      </pre>
      <div className="mt-3 flex gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="press flex-1 py-2 border border-border rounded-xs font-mono text-mono11 text-text"
            data-testid="err-retry"
          >
            RETRY
          </button>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className="press flex-1 py-2 border border-border rounded-xs font-mono text-mono11 text-muted"
          data-testid="err-report"
        >
          COPY_TRACE
        </button>
      </div>
    </div>
  );
}
