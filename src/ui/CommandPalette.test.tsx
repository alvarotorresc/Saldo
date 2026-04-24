import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Command } from './CommandPalette';
import { CommandPalette } from './CommandPalette';

const makeCmds = (): Command[] => [
  { id: 'new-tx', label: 'New transaction', hint: 'nt', onRun: vi.fn() },
  { id: 'import', label: 'Import CSV', hint: 'i', onRun: vi.fn() },
  { id: 'export', label: 'Export data', hint: 'e', onRun: vi.fn() },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CommandPalette', () => {
  it('does not render when open=false', () => {
    const cmds = makeCmds();
    render(<CommandPalette open={false} onClose={vi.fn()} commands={cmds} />);
    expect(screen.queryByTestId('cmd-palette')).toBeNull();
  });

  it('renders full list when open=true and query is empty', () => {
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);
    expect(screen.getByTestId('cmd-item-new-tx')).toBeTruthy();
    expect(screen.getByTestId('cmd-item-import')).toBeTruthy();
    expect(screen.getByTestId('cmd-item-export')).toBeTruthy();
  });

  it('focuses input on open (requestAnimationFrame)', async () => {
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);
    const input = screen.getByTestId('cmd-input');
    await waitFor(() => expect(input).toHaveFocus());
  });

  it('filters via fuzzy as the user types', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);

    const input = screen.getByTestId('cmd-input');
    await user.type(input, 'new');

    expect(screen.getByTestId('cmd-item-new-tx')).toBeTruthy();
    expect(screen.queryByTestId('cmd-item-import')).toBeNull();
    expect(screen.queryByTestId('cmd-item-export')).toBeNull();
  });

  it('shows "No commands match" when no result', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);

    const input = screen.getByTestId('cmd-input');
    await user.type(input, 'zzz');

    expect(screen.getByText('No commands match')).toBeTruthy();
  });

  it('ArrowDown moves active index forward and stops at filtered.length-1', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);

    const input = screen.getByTestId('cmd-input');

    // Press ArrowDown twice: goes from 0 → 1 → 2
    await user.type(input, '{ArrowDown}{ArrowDown}');
    // Item at index 2 should be active (text-accent)
    const exportItem = screen.getByTestId('cmd-item-export');
    expect(exportItem.className).toContain('text-accent');

    // Press ArrowDown again: should clamp at index 2
    await user.type(input, '{ArrowDown}');
    expect(exportItem.className).toContain('text-accent');
  });

  it('ArrowUp moves active index back, clamps at 0', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);

    const input = screen.getByTestId('cmd-input');

    // Move down to index 1 first
    await user.type(input, '{ArrowDown}');
    const importItem = screen.getByTestId('cmd-item-import');
    expect(importItem.className).toContain('text-accent');

    // Move up back to index 0
    await user.type(input, '{ArrowUp}');
    const newTxItem = screen.getByTestId('cmd-item-new-tx');
    expect(newTxItem.className).toContain('text-accent');

    // ArrowUp at 0 should clamp at 0
    await user.type(input, '{ArrowUp}');
    expect(newTxItem.className).toContain('text-accent');
  });

  it('Enter runs commands[active].onRun and calls onClose', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={cmds} />);

    const input = screen.getByTestId('cmd-input');
    // Default active is 0 (new-tx)
    await user.type(input, '{Enter}');

    expect(cmds[0].onRun).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape calls onClose without running any command', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={cmds} />);

    const input = screen.getByTestId('cmd-input');
    await user.type(input, '{Escape}');

    expect(onClose).toHaveBeenCalled();
    expect(cmds[0].onRun).not.toHaveBeenCalled();
    expect(cmds[1].onRun).not.toHaveBeenCalled();
    expect(cmds[2].onRun).not.toHaveBeenCalled();
  });

  it('MouseEnter on list item sets active to that index', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);

    const importItem = screen.getByTestId('cmd-item-import');
    await user.hover(importItem);

    expect(importItem.className).toContain('text-accent');
  });

  it('Click on list item runs onRun + onClose', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    const onClose = vi.fn();
    render(<CommandPalette open={true} onClose={onClose} commands={cmds} />);

    const exportItem = screen.getByTestId('cmd-item-export');
    await user.click(exportItem);

    expect(cmds[2].onRun).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('resets query and active to 0 when open transitions false→true', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    const onClose = vi.fn();
    const { rerender } = render(<CommandPalette open={false} onClose={onClose} commands={cmds} />);

    // Open
    rerender(<CommandPalette open={true} onClose={onClose} commands={cmds} />);
    const input = screen.getByTestId('cmd-input');

    // Type a query and navigate away from first item
    await user.type(input, 'import{ArrowDown}');

    // Close then reopen
    rerender(<CommandPalette open={false} onClose={onClose} commands={cmds} />);
    rerender(<CommandPalette open={true} onClose={onClose} commands={cmds} />);

    const inputAfterReopen = screen.getByTestId('cmd-input');
    expect((inputAfterReopen as HTMLInputElement).value).toBe('');
    // Active should be 0: first item has text-accent
    expect(screen.getByTestId('cmd-item-new-tx').className).toContain('text-accent');
  });

  it('active index clamps to 0 when filtering shrinks the list below current active', async () => {
    const user = userEvent.setup();
    const cmds = makeCmds();
    render(<CommandPalette open={true} onClose={vi.fn()} commands={cmds} />);

    const input = screen.getByTestId('cmd-input');

    // Navigate to index 2 (Export data)
    await user.type(input, '{ArrowDown}{ArrowDown}');
    expect(screen.getByTestId('cmd-item-export').className).toContain('text-accent');

    // Type a query that narrows to 1 result (only "New transaction" matches "new")
    // active=2 but filtered.length will be 1, so effect clamps to 0
    await user.type(input, 'new');

    // Only new-tx should be visible and active
    expect(screen.getByTestId('cmd-item-new-tx').className).toContain('text-accent');
    expect(screen.queryByTestId('cmd-item-import')).toBeNull();
    expect(screen.queryByTestId('cmd-item-export')).toBeNull();
  });
});
