/**
 * Pure helpers for the ErrorState screen. We render a Rust-like stack trace
 * that is authentic to the user (no fake functions) — it takes the real
 * Error object captured by the ErrorBoundary and formats each line.
 */

export interface TraceFrame {
  fn: string;
  file?: string;
  line?: number;
  col?: number;
}

const FRAME_RE =
  /^\s*at\s+(?:(?<fn>[^\s]+)\s+\()?(?<file>[^)]+?)(?::(?<line>\d+)(?::(?<col>\d+))?)?\)?\s*$/;

export function parseStack(stack: string | undefined): TraceFrame[] {
  if (!stack) return [];
  const frames: TraceFrame[] = [];
  for (const raw of stack.split('\n').slice(1)) {
    const m = raw.match(FRAME_RE);
    if (!m?.groups) continue;
    frames.push({
      fn: m.groups.fn ?? '<anonymous>',
      file: m.groups.file?.trim() || undefined,
      line: m.groups.line ? Number(m.groups.line) : undefined,
      col: m.groups.col ? Number(m.groups.col) : undefined,
    });
  }
  return frames;
}

export interface FormattedTrace {
  title: string;
  lines: string[];
}

export function formatTrace(err: Error | { message: string; stack?: string }): FormattedTrace {
  const frames = parseStack(err.stack);
  const lines: string[] = [`error[E0001]: ${err.message}`, '  |'];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const where = f.file ? ` in ${f.file}${f.line != null ? `:${f.line}` : ''}` : '';
    lines.push(`  ${i === 0 ? '-->' : '  '} ${f.fn}${where}`);
  }
  if (frames.length === 0) lines.push('  (no stack available)');
  return { title: err.message, lines };
}
