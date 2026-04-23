import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TopBarV2 } from './TopBarV2';

describe('TopBarV2', () => {
  it('renders default title when no title prop given', () => {
    render(<TopBarV2 />);
    expect(screen.getByText('saldo@local')).toBeTruthy();
  });

  it('renders custom title', () => {
    render(<TopBarV2 title="saldo" />);
    expect(screen.getByText('saldo')).toBeTruthy();
  });

  it('renders sub when provided', () => {
    render(<TopBarV2 title="saldo" sub="ONBOARD / PIN" />);
    expect(screen.getByText(/ONBOARD \/ PIN/)).toBeTruthy();
  });

  it('does not render sub section when sub is undefined', () => {
    render(<TopBarV2 title="saldo" />);
    expect(screen.queryByText(/\//)).toBeNull();
  });

  it('renders back button when onBack is provided', () => {
    const onBack = vi.fn();
    render(<TopBarV2 onBack={onBack} />);
    expect(screen.getByRole('button', { name: 'Atrás' })).toBeTruthy();
  });

  it('does not render back button when onBack is not provided', () => {
    render(<TopBarV2 />);
    expect(screen.queryByRole('button', { name: 'Atrás' })).toBeNull();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<TopBarV2 onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders right slot content', () => {
    render(<TopBarV2 right={<button>Settings</button>} />);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('does not render right area when right is undefined', () => {
    const { container } = render(<TopBarV2 />);
    // Only one child div (left), no right div rendered
    const header = container.querySelector('header');
    // Only 1 child with gap-1.5 (the left), the right conditional is absent
    expect(header?.children).toHaveLength(1);
  });

  it('renders accent bar character', () => {
    render(<TopBarV2 />);
    expect(screen.getByText('▌')).toBeTruthy();
  });
});
