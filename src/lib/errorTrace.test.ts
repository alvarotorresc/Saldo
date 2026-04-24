import { describe, it, expect } from 'vitest';
import { formatTrace, parseStack } from './errorTrace';

describe('parseStack', () => {
  it('extracts function name, file and line/col from v8-style frames', () => {
    const stack = `Error: boom
    at doStuff (file:///src/a.ts:12:3)
    at run (file:///src/b.ts:45:10)`;
    const frames = parseStack(stack);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({ fn: 'doStuff', line: 12, col: 3 });
    expect(frames[1]).toMatchObject({ fn: 'run', line: 45 });
  });

  it('returns [] for undefined input', () => {
    expect(parseStack(undefined)).toEqual([]);
  });
});

describe('formatTrace', () => {
  it('produces a compact Rust-style report with error title and frames', () => {
    const err: { message: string; stack?: string } = {
      message: 'no se pudo abrir la base',
      stack: `Error: no se pudo abrir la base
    at openDb (file:///src/db.ts:3:1)`,
    };
    const out = formatTrace(err);
    expect(out.title).toBe('no se pudo abrir la base');
    expect(out.lines[0]).toContain('error[E0001]');
    expect(out.lines.some((l) => l.includes('openDb'))).toBe(true);
  });

  it('emits "no stack available" when the error has no stack', () => {
    const out = formatTrace({ message: 'cold crash' });
    expect(out.lines.some((l) => l.includes('no stack available'))).toBe(true);
  });
});
